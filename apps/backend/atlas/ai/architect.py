"""LLM steps of the hybrid pipeline: architecture review, change proposals, narratives.

The model never touches the canvas directly. Its output is parsed, validated against the
ontology, and either merged into an initial draft (generation) or returned as a proposal the
user must apply.
"""

from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field

from atlas.ai.context import render_architecture, render_catalog, render_estate
from atlas.ai.ollama import AIUnavailable, OllamaClient
from atlas.ai.parsing import parse_model
from atlas.ai.prompts import (
    PERSONA_FRAMING,
    RECOMMEND_PROMPT,
    RECOMMEND_SYSTEM,
    PROPOSE_PROMPT,
    PROPOSE_SYSTEM,
    REVIEW_PROMPT,
    REVIEW_SYSTEM,
)
from atlas.architecture.ops import apply_operations
from atlas.models.architecture import Architecture, ArchitectureRisk, Operation, OperationConnect, Proposal
from atlas.models.project import Estate
from atlas.ontology.service import OntologyService
from atlas.rules.connections import ConnectionEngine

log = logging.getLogger(__name__)


class _Add(BaseModel):
    tech_id: str
    reason: str = ""
    connect_from: list[str] = Field(default_factory=list)
    connect_to: list[str] = Field(default_factory=list)


class _Risk(BaseModel):
    title: str
    detail: str = ""
    severity: str = "medium"


class _Review(BaseModel):
    add: list[_Add] = Field(default_factory=list)
    architecture_notes: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    risks: list[_Risk] = Field(default_factory=list)


class _Op(BaseModel):
    op: Literal["add_node", "remove_node", "replace_node"]
    tech_id: str
    with_: str | None = Field(default=None, alias="with")
    connect_from: list[str] = Field(default_factory=list)
    connect_to: list[str] = Field(default_factory=list)
    model_config = {"populate_by_name": True}


class _Prop(BaseModel):
    title: str
    reason: str = ""
    confidence: str = "medium"
    operations: list[_Op] = Field(default_factory=list)


class _Props(BaseModel):
    proposals: list[_Prop] = Field(default_factory=list)


def _clean(items: list[str], limit: int) -> list[str]:
    out = []
    for s in items:
        s = " ".join(str(s).split())
        if 8 <= len(s) <= 400 and s not in out:
            out.append(s)
    return out[:limit]


class _Recommendation(BaseModel):
    recommended: str
    headline: str = ""
    rationale: str = ""
    choose_when: dict[str, str] = Field(default_factory=dict)
    caveats: list[str] = Field(default_factory=list)


class ArchitectAI:
    def __init__(self, ontology: OntologyService, engine: ConnectionEngine, ollama: OllamaClient, skills=None):
        self.ontology = ontology
        self.engine = engine
        self.ollama = ollama
        self.skills = skills

    def _playbooks(self, text: str, arch: Architecture | None = None, estate: Estate | None = None) -> str:
        if not self.skills:
            return ""
        ids = [n.tech_id for n in arch.nodes] if arch else []
        ids += list(estate.current_technologies) + list(estate.target_platforms) if estate else []
        picked = self.skills.select(text, tech_ids=ids, focus_ids=list(estate.current_technologies) if estate else [])
        return ("PLAYBOOKS\n" + self.skills.render(picked, max_chars=1800)) if picked else ""

    async def recommend(self, options: list[Architecture], analysis, estate: Estate) -> tuple[dict | None, str | None]:
        """LLM best-fit recommendation over the deterministic fit table. Returns (fields, model) or (None, None)."""
        by_letter = {f.label: f for f in analysis.fits}
        opts = "\n".join(f"Option {f.label}: {f.name} — {f.summary} ({f.component_count} components, {f.high_findings} high findings)"
                         for f in analysis.fits)
        fit = "\n".join(f"Option {f.label} [{f.fit_percent}%]: " + "; ".join(f"{c.name} ({c.priority}) {c.score}/3 — {c.evidence}" for c in f.criteria)
                         for f in analysis.fits)
        prompt = RECOMMEND_PROMPT.format(estate=render_estate(estate, self.ontology), options=opts, fit=fit,
                                         playbooks=self._playbooks("platform selection best fit", options[0] if options else None, estate))
        try:
            raw, model = await self.ollama.generate_json(RECOMMEND_SYSTEM, prompt, num_predict=700)
        except AIUnavailable:
            return None, None
        rec, _ = parse_model(raw, _Recommendation)
        letter = (rec.recommended.strip().upper().replace("OPTION", "").strip()[:1]) if rec else ""
        if not rec or letter not in by_letter:
            return None, None
        return {
            "recommended_option_id": by_letter[letter].option_id,
            "headline": rec.headline[:240],
            "rationale": rec.rationale[:900],
            "choose_when": {by_letter[k.strip().upper()[-1:]].option_id: v[:400] for k, v in rec.choose_when.items()
                            if k.strip() and k.strip().upper()[-1:] in by_letter},
            "caveats": [c[:300] for c in rec.caveats[:3]],
        }, model

    def _first_node(self, arch: Architecture, tech_id: str):
        return next((n for n in arch.nodes if n.tech_id == tech_id), None)

    def _allowed(self, tech_id: str, cloud: str | None, platform: str | None) -> bool:
        t = self.ontology.get(tech_id)
        if not t or t.legacy:
            return False
        if t.platforms and platform not in t.platforms:
            return False
        return t.runs_on(cloud)

    async def review(self, arch: Architecture, estate: Estate) -> tuple[Architecture, str]:
        """Step 5 of the pipeline. Returns (architecture, status note). Falls back to the input."""
        cloud, platform = arch.meta.target_cloud, arch.meta.data_platform
        prompt = REVIEW_PROMPT.format(
            estate=render_estate(estate, self.ontology),
            constraints=", ".join(f"{c.id} ({c.priority})" for c in estate.constraints) or "none",
            architecture=render_architecture(arch, self.ontology),
            catalog=render_catalog(self.ontology, cloud),
        ) + "\n\n" + self._playbooks(" ".join(c.id for c in estate.constraints), arch, estate)
        try:
            raw, model = await self.ollama.generate_json(REVIEW_SYSTEM, prompt, num_predict=900)
        except AIUnavailable as exc:
            return arch, f"Local AI review skipped — {exc.message} The architecture comes from ontology rules alone."
        review, err = parse_model(raw, _Review)
        if not review:
            log.info("AI review unusable: %s", err)
            return arch, f"Local AI review was unusable ({err}); kept the rules-based architecture."

        ops, rejected = [], []
        present = {n.tech_id for n in arch.nodes}
        for add in review.add[:3]:
            if add.tech_id in present:
                continue  # already in the draft — agreement, not a rejection
            if not self._allowed(add.tech_id, cloud, platform):
                rejected.append(add.tech_id)
                continue
            connects = [OperationConnect(node=n.id, direction="from") for t in add.connect_from if (n := self._first_node(arch, t))]
            connects += [OperationConnect(node=n.id, direction="to") for t in add.connect_to if (n := self._first_node(arch, t))]
            if not connects:
                rejected.append(add.tech_id)
                continue
            ops.append(Operation(op="add_node", tech_id=add.tech_id, connect=connects))
            present.add(add.tech_id)
        out = apply_operations(arch, ops, self.ontology, self.engine, origin="ai") if ops else arch.model_copy(deep=True)
        for add in review.add:
            if add.tech_id in {o.tech_id for o in ops} and add.reason:
                node = self._first_node(out, add.tech_id)
                if node:
                    node.notes = add.reason
        out.architecture_notes += [f"AI: {n}" for n in _clean(review.architecture_notes, 4)]
        out.assumptions += _clean(review.assumptions, 4)
        for r in review.risks[:4]:
            sev = r.severity if r.severity in {"high", "medium", "low"} else "medium"
            out.risks.append(ArchitectureRisk(title=r.title[:120], detail=r.detail[:400], severity=sev, source="ai"))  # type: ignore[arg-type]
        out.meta.generated_by = f"rules+ai:{model}"
        out.meta.model = model
        note = f"Reviewed by {model}: added {len(ops)} component(s)"
        if rejected:
            note += f", rejected {len(rejected)} suggestion(s) that failed ontology checks ({', '.join(rejected)})"
        return out, note + "."

    async def propose(self, arch: Architecture, estate: Estate | None, request: str) -> tuple[list[Proposal], str | None]:
        cloud, platform = arch.meta.target_cloud, arch.meta.data_platform
        prompt = PROPOSE_PROMPT.format(
            architecture=render_architecture(arch, self.ontology),
            estate=render_estate(estate, self.ontology),
            catalog=render_catalog(self.ontology, cloud),
            request=request[:500],
        ) + "\n\n" + self._playbooks(request, arch, estate)
        try:
            raw, model = await self.ollama.generate_json(PROPOSE_SYSTEM, prompt, num_predict=900)
        except AIUnavailable as exc:
            return [], exc.message
        parsed, err = parse_model(raw, _Props)
        if not parsed:
            return [], err
        proposals: list[Proposal] = []
        for p in parsed.proposals[:3]:
            ops: list[Operation] = []
            evidence: list[str] = []
            for i, op in enumerate(p.operations[:4]):
                if op.op == "add_node" and self._allowed(op.tech_id, cloud, platform):
                    connects = [OperationConnect(node=n.id, direction="from") for t in op.connect_from if (n := self._first_node(arch, t))]
                    connects += [OperationConnect(node=n.id, direction="to") for t in op.connect_to if (n := self._first_node(arch, t))]
                    ops.append(Operation(op="add_node", tech_id=op.tech_id, node_id=f"new{i}", connect=connects))
                    evidence.append(f"{self.ontology.require(op.tech_id).name}: {self.ontology.require(op.tech_id).description}")
                elif op.op == "remove_node" and (n := self._first_node(arch, op.tech_id)):
                    ops.append(Operation(op="remove_node", node_id=n.id))
                elif op.op == "replace_node" and op.with_ and (n := self._first_node(arch, op.tech_id)) and self.ontology.exists(op.with_):
                    ops.append(Operation(op="replace_node", node_id=n.id, tech_id=op.with_))
                    evidence.append(f"{self.ontology.require(op.with_).name}: {self.ontology.require(op.with_).description}")
            if not ops:
                continue
            conf = p.confidence if p.confidence in {"high", "medium", "low"} else "medium"
            proposals.append(Proposal(title=p.title[:120], reason=p.reason[:600], source="ai", operations=ops,
                                      evidence=evidence, confidence=conf))  # type: ignore[arg-type]
        return proposals, None if proposals else "The model did not propose any change that passed ontology checks."

    async def narrative(self, persona: str, prompt: str) -> str | None:
        system = "You are a migration architect writing for a migration plan. " + PERSONA_FRAMING.get(persona, "")
        system += " Return JSON: {\"text\": \"<markdown>\"}."
        try:
            raw, _ = await self.ollama.generate_json(system, prompt, num_predict=600, temperature=0.4)
        except AIUnavailable:
            return None

        class _T(BaseModel):
            text: str

        parsed, _ = parse_model(raw, _T)
        return parsed.text.strip() if parsed else None
