from __future__ import annotations

import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, ValidationError

from atlas.api.deps import AtlasError, not_found, services
from atlas.architecture.ops import apply_proposal, replace_component
from atlas.architecture.whatif import interpret_what_if
from atlas.models.architecture import Architecture, Operation, OperationConnect, Proposal
from atlas.models.project import Estate
from atlas.services import Services

router = APIRouter(prefix="/architecture", tags=["architecture"])


class GenerateBody(BaseModel):
    estate: Estate
    use_ai: bool = True
    name: str | None = None


@router.post("/generate")
async def generate(body: GenerateBody, svc: Services = Depends(services)):
    """Hybrid pipeline: rules → ontology → graph → RAG → local AI review → validation."""
    estate = body.estate
    if not estate.current_technologies and not estate.target_platforms and not estate.target_cloud:
        raise AtlasError(422, "empty_estate", "Describe the current estate or pick a target before generating.")
    pipeline = []
    arch = svc.generator.generate(estate, name=body.name)
    pipeline.append({"step": "rules", "label": "Deterministic architecture rules",
                     "detail": f"{len(arch.nodes)} components from platform building blocks"})
    pipeline.append({"step": "ontology", "label": "Technology ontology",
                     "detail": f"{sum(1 for n in arch.nodes if n.replaces)} legacy mappings applied"})
    graph_facts = sum(len(svc.graph.neighbors(f"tech:{t}", ["MIGRATES_TO", "REPLACES"])) for t in estate.current_technologies)
    pipeline.append({"step": "graph", "label": "Knowledge graph", "detail": f"{graph_facts} migration relationships consulted"})
    names = " ".join(svc.ontology.get(t).name for t in estate.current_technologies + estate.target_platforms if svc.ontology.get(t))
    hits = svc.store.search(f"{names} migration", limit=5)
    pipeline.append({"step": "rag", "label": "Documentation retrieval", "detail": f"{len(hits)} reference passages"})
    if body.use_ai:
        arch, note = await svc.architect_ai.review(arch, estate)
        arch.meta.ai_status = note
        pipeline.append({"step": "ai", "label": "Local AI reasoning", "detail": note})
    else:
        arch.meta.ai_status = "Local AI review was turned off for this generation."
        pipeline.append({"step": "ai", "label": "Local AI reasoning", "detail": "Skipped (rules only)"})
    report = svc.validator.validate(arch, estate)
    pipeline.append({"step": "validate", "label": "Validation rules",
                     "detail": f"{len(report.findings)} findings, {report.counts.get('high', 0) + report.counts.get('critical', 0)} high/critical"})
    svc.engine.annotate(arch)
    return {"architecture": arch.model_dump(), "validation": report.model_dump(), "pipeline": pipeline,
            "citations": [h.citation.model_dump() for h in hits]}


class ValidateBody(BaseModel):
    architecture: Architecture
    estate: Estate | None = None


@router.post("/validate")
def validate(body: ValidateBody, svc: Services = Depends(services)):
    return svc.validator.validate(body.architecture, body.estate).model_dump()


class CompareBody(BaseModel):
    options: list[Architecture]
    estate: Estate | None = None
    persona: str = "architect"
    narrative: bool = False


@router.post("/compare")
async def compare(body: CompareBody, svc: Services = Depends(services)):
    if len(body.options) < 2:
        raise AtlasError(422, "need_two_options", "Create at least two architecture options to compare.")
    result = svc.comparer.compare(body.options, body.estate)
    result["narrative"] = None
    if body.narrative:
        from atlas.ai.prompts import COMPARE_NARRATIVE_PROMPT

        summary = "\n".join(
            f"- {o['name']}: {o['component_count']} components; operational model {o['operational_model']}; "
            f"rewrite {[r['from'] + '→' + r['to'] for r in o['rewrite_areas']]}; governance {o['governance_approach']}; "
            f"complexity {o['complexity_drivers']}" for o in result["options"])
        result["narrative"] = await svc.architect_ai.narrative(body.persona, COMPARE_NARRATIVE_PROMPT.format(options=summary))
    return result


class ExplainBody(BaseModel):
    architecture: Architecture
    node_id: str | None = None
    edge_id: str | None = None


@router.post("/explain")
def explain(body: ExplainBody, svc: Services = Depends(services)):
    """Deterministic facts about a node or connection. The AI narrative streams from /ai/chat."""
    arch = body.architecture
    if body.edge_id:
        edge = next((e for e in arch.edges if e.id == body.edge_id), None)
        if not edge:
            raise not_found("Connection")
        a = svc.engine.assess_edge(arch, edge)
        src, dst = arch.node(edge.source), arch.node(edge.target)
        return {"type": "edge", "assessment": a.model_dump(), "edge": edge.model_dump(),
                "source": svc.ontology.get(src.tech_id).model_dump() if src and svc.ontology.get(src.tech_id) else None,
                "target": svc.ontology.get(dst.tech_id).model_dump() if dst and svc.ontology.get(dst.tech_id) else None}
    if body.node_id:
        node = arch.node(body.node_id)
        if not node:
            raise not_found("Component")
        tech = svc.ontology.get(node.tech_id)
        incoming = [svc.engine.assess_edge(arch, e).model_dump() | {"edge_id": e.id} for e in arch.edges if e.target == node.id]
        outgoing = [svc.engine.assess_edge(arch, e).model_dump() | {"edge_id": e.id} for e in arch.edges if e.source == node.id]
        return {"type": "node", "node": node.model_dump(), "technology": tech.model_dump() if tech else None,
                "incoming": incoming, "outgoing": outgoing,
                "mappings": [m.model_dump() for m in svc.ontology.mappings_for(node.tech_id)],
                "graph": svc.graph.describe(node.tech_id)}
    raise AtlasError(422, "nothing_selected", "Select a component or a connection to explain.")


class ReplaceBody(BaseModel):
    architecture: Architecture
    node_id: str
    new_tech_id: str


@router.post("/replace-component")
def replace(body: ReplaceBody, svc: Services = Depends(services)):
    node = body.architecture.node(body.node_id)
    if not node:
        raise not_found("Component")
    old, new = svc.ontology.get(node.tech_id), svc.ontology.get(body.new_tech_id)
    if not new:
        raise not_found(f"Technology '{body.new_tech_id}'")
    arch, kept, dropped = replace_component(body.architecture, body.node_id, body.new_tech_id, svc.ontology, svc.engine)
    changes = []
    if old:
        if old.operational_model != new.operational_model:
            changes.append(f"Operating model changes from {old.operational_model} to {new.operational_model}.")
        gained = [c for c in new.capabilities if c not in old.capabilities][:5]
        lost = [c for c in old.capabilities if c not in new.capabilities][:5]
        if gained:
            changes.append("Gains: " + ", ".join(gained) + ".")
        if lost:
            changes.append("No longer provided by this node: " + ", ".join(lost) + " — confirm another component covers them.")
        new_skills = [s for s in new.skills if s not in old.skills][:4]
        if new_skills:
            changes.append("Team skills needed: " + ", ".join(new_skills) + ".")
        maps = svc.ontology.mappings_between(old.id, new.id)
        if maps:
            m = maps[0]
            changes.append(f"Mapping '{m.title or m.id}': automation potential {m.automation_potential}.")
            changes += [f"Consider: {c}" for c in m.conversion_considerations[:2]]
    if dropped:
        changes.append(f"{len(dropped)} connection(s) removed because they no longer make sense.")
    return {"architecture": arch.model_dump(), "kept": kept, "dropped": dropped, "changes": changes,
            "validation": svc.validator.validate(arch).model_dump()}


class ApplyBody(BaseModel):
    architecture: Architecture
    proposal: Proposal
    estate: Estate | None = None


@router.post("/apply-proposal")
def apply(body: ApplyBody, svc: Services = Depends(services)):
    arch = apply_proposal(body.architecture, body.proposal, svc.ontology, svc.engine)
    return {"architecture": arch.model_dump(), "validation": svc.validator.validate(arch, body.estate).model_dump()}


INTENTS = [
    (re.compile(r"governance|catalog|lineage|access control", re.I), ("GOV-",)),
    (re.compile(r"monitor|observab|logging|alert", re.I), ("OBS-", "OPS-")),
    (re.compile(r"reconcil|data quality|validation", re.I), ("MIG-001",)),
    (re.compile(r"disaster|\bdr\b|failover", re.I), ("REL-002",)),
    (re.compile(r"backup|recovery", re.I), ("REL-001",)),
    (re.compile(r"retry|dead[- ]letter|resilien", re.I), ("REL-004", "REL-")),
    (re.compile(r"secur|secret|iam|encrypt|network", re.I), ("SEC-",)),
    (re.compile(r"cutover|rollback|parallel", re.I), ("MIG-",)),
    (re.compile(r"orchestrat|schedul|control-?m", re.I), ("ARCH-002", "ARCH-003")),
    (re.compile(r"missing|gap|improve|fix|best practice", re.I), ("",)),
]


class ProposeBody(BaseModel):
    architecture: Architecture
    estate: Estate | None = None
    request: str = Field(default="Improve this architecture")
    use_ai: bool = True


@router.post("/propose")
async def propose(body: ProposeBody, svc: Services = Depends(services)):
    """AI actions. Rule-backed proposals first; local-AI proposals for anything rules don't cover."""
    arch = body.architecture
    report = svc.validator.validate(arch, body.estate)
    prefixes: list[str] = []
    for rx, pre in INTENTS:
        if rx.search(body.request):
            prefixes.extend(pre)
    rule_props: list[Proposal] = []
    for f in report.findings:
        if f.proposal and any(f.id.startswith(p) or f.rule_id.startswith(p) for p in prefixes):
            prop = f.proposal.model_copy(update={"reason": f.proposal.reason or f.detail})
            prop.evidence = [*f.evidence, *prop.evidence]
            rule_props.append(prop)
    # Streaming layer is a frequent ask that is constructive rather than a fix.
    if re.search(r"stream|real[- ]time|event", body.request, re.I) and not any(
            svc.ontology.get(n.tech_id) and svc.ontology.get(n.tech_id).role == "streaming" for n in arch.nodes):
        cloud = svc.ontology.data.platforms.clouds.get(arch.meta.target_cloud or "")
        stream_id = cloud.get("streaming") if cloud else "apache-kafka"
        cdc = [n for n in arch.nodes if svc.ontology.get(n.tech_id) and svc.ontology.get(n.tech_id).role == "cdc"]
        first = [n for n in arch.nodes if svc.ontology.get(n.tech_id) and svc.ontology.get(n.tech_id).stage in {"bronze", "raw"}]
        if stream_id and svc.ontology.exists(stream_id):
            t = svc.ontology.require(stream_id)
            rule_props.append(Proposal(
                title=f"Add a streaming layer with {t.name}", source="rules", confidence="high",
                reason="A streaming backbone decouples change capture from consumers and enables near-real-time pipelines.",
                evidence=[f"{t.name}: {t.description}"],
                operations=[Operation(op="add_node", tech_id=stream_id, node_id="new",
                                      connect=[*[OperationConnect(node=n.id, direction="from") for n in cdc[:2]],
                                               *[OperationConnect(node=n.id, direction="to") for n in first[:1]]])]))
    m = re.search(r"\b(?:replace|swap|switch|substitute)\s+(.+?)\s+(?:with|for|by|to)\s+(.+)$|\buse\s+(.+?)\s+instead\s+of\s+(.+)$",
                  body.request.strip().rstrip(".?!"), re.I)
    if m:
        old_text, new_text = (m.group(1), m.group(2)) if m.group(1) else (m.group(4), m.group(3))
        old_ids, new_ids = svc.ontology.mentions(old_text), svc.ontology.mentions(new_text)
        for old in old_ids[:1]:
            # The component may already have been modernised: then target the node that replaced it.
            node = next((n for n in arch.nodes if n.tech_id == old), None) or next((n for n in arch.nodes if old in n.replaces), None)
            cands = [svc.ontology.get(t) for t in new_ids if svc.ontology.get(t)] or [
                c for c in svc.ontology.replacement_candidates(old, arch.meta.target_cloud)
                if (not c.platforms or arch.meta.data_platform in c.platforms) and c.runs_on(arch.meta.target_cloud)][:1]
            if node and cands and cands[0].id != node.tech_id:
                c = cands[0]
                current = svc.ontology.require(node.tech_id).name
                via = f", now implemented by {current}," if node.tech_id != old else ""
                maps = svc.ontology.mappings_between(old, c.id)
                ev = [c.description] + ([f"Mapping: {maps[0].approaches[0]}"] if maps and maps[0].approaches else [])
                rule_props.append(Proposal(title=f"Replace {current} with {c.name}", source="rules", confidence="high" if new_ids else "medium",
                                           reason=f"{svc.ontology.require(old).name}{via} is replaced by {c.name}, which takes over its role; compatible connections are kept.",
                                           evidence=ev, operations=[Operation(op="replace_node", node_id=node.id, tech_id=c.id)]))
    rule_props = list({p.title: p for p in rule_props}.values())[:5]
    ai_props, ai_note = [], None
    explicit_replace = bool(m) and any(p.operations and p.operations[0].op == "replace_node" for p in rule_props)
    if body.use_ai and not explicit_replace and (len(rule_props) < 2 or not prefixes):
        ai_props, ai_note = await svc.architect_ai.propose(arch, body.estate, body.request)
    return {"proposals": [p.model_dump() for p in rule_props + ai_props], "ai_note": ai_note}


class WhatIfBody(BaseModel):
    architecture: Architecture
    estate: Estate
    question: str
    use_ai: bool = False


@router.post("/what-if")
async def what_if(body: WhatIfBody, svc: Services = Depends(services)):
    estate, changes = interpret_what_if(body.question, body.estate, svc.ontology)
    if not changes:
        raise AtlasError(422, "what_if_not_understood",
                         "I couldn't map that scenario to the ontology. Try naming a technology, cloud or constraint — "
                         "e.g. 'What if we use BigQuery instead?' or 'What if downtime must be under 30 minutes?'")
    scenario = re.sub(r"^\s*what\s+if\s+", "", body.question.strip(), flags=re.I).rstrip("?").strip()
    arch = svc.generator.generate(estate, name=f"What if {scenario[:60]}")
    if body.use_ai:
        arch, note = await svc.architect_ai.review(arch, estate)
        arch.meta.ai_status = note
    arch.meta.parent_id = body.architecture.id
    arch.meta.what_if = body.question
    arch.architecture_notes.insert(0, "Scenario: " + "; ".join(changes) + ".")
    report = svc.validator.validate(arch, estate)
    before = {n.tech_id for n in body.architecture.nodes}
    after = {n.tech_id for n in arch.nodes}
    name = lambda ids: sorted(svc.ontology.get(i).name for i in ids if svc.ontology.get(i))  # noqa: E731
    return {"architecture": arch.model_dump(), "estate": estate.model_dump(), "changes": changes,
            "added": name(after - before), "removed": name(before - after), "validation": report.model_dump()}


class ImportBody(BaseModel):
    data: dict


@router.post("/import")
def import_architecture(body: ImportBody, svc: Services = Depends(services)):
    raw = body.data.get("architecture", body.data)
    try:
        arch = Architecture.model_validate(raw)
    except ValidationError as exc:
        raise AtlasError(422, "invalid_architecture",
                         f"This file is not a valid Migration Atlas architecture ({exc.errors()[0]['msg']}).") from exc
    unknown = [n.tech_id for n in arch.nodes if not svc.ontology.exists(n.tech_id)]
    node_ids = {n.id for n in arch.nodes}
    arch.edges = [e for e in arch.edges if e.source in node_ids and e.target in node_ids]
    svc.engine.annotate(arch)
    return {"architecture": arch.model_dump(), "unknown_technologies": unknown}


class OptionsBody(BaseModel):
    estate: Estate
    count: int = 3
    use_ai: bool = True


async def _analysis(svc: Services, options: list[Architecture], estate: Estate, use_ai: bool) -> dict:
    analysis = svc.options.analyse(options, estate)
    if use_ai and len(options) > 1:
        rec, model = await svc.architect_ai.recommend(options, analysis, estate)
        if rec:
            analysis = analysis.model_copy(update={**rec, "decided_by": f"rules+ai:{model}"})
    return analysis.model_dump()


@router.post("/options")
async def options(body: OptionsBody, svc: Services = Depends(services)):
    """Generate several distinct target architectures and analyse their fit to the stated priorities."""
    estate = body.estate
    if not estate.current_technologies and not estate.target_platforms and not estate.target_cloud:
        raise AtlasError(422, "empty_estate", "Describe the current estate or pick a target before generating.")
    archs = svc.options.build(estate, count=max(1, min(body.count, 4)))
    pipeline = [{"step": "rules", "label": "Deterministic architecture rules",
                 "detail": f"{len(archs)} distinct options: " + "; ".join(a.meta.summary or a.name for a in archs)}]
    names = " ".join(svc.ontology.get(t).name for t in estate.current_technologies + estate.target_platforms if svc.ontology.get(t))
    hits = svc.store.search(f"{names} migration", limit=5)
    pipeline.append({"step": "ontology", "label": "Technology ontology",
                     "detail": f"{sum(1 for a in archs for n in a.nodes if n.replaces)} legacy mappings applied across options"})
    pipeline.append({"step": "graph", "label": "Knowledge graph", "detail": "Migration relationships consulted for every option"})
    pipeline.append({"step": "rag", "label": "Documentation retrieval", "detail": f"{len(hits)} reference passages"})
    if body.use_ai and archs:
        # Review only the requested option with the model; alternatives stay rules-only to keep generation fast.
        reviewed, note = await svc.architect_ai.review(archs[0], estate)
        reviewed.meta.ai_status = note
        archs[0] = reviewed
        pipeline.append({"step": "ai", "label": "Local AI reasoning", "detail": note})
    else:
        for a in archs:
            a.meta.ai_status = "Local AI review was turned off for this generation."
        pipeline.append({"step": "ai", "label": "Local AI reasoning", "detail": "Skipped (rules only)"})
    for a in archs:
        svc.engine.annotate(a)
    analysis = await _analysis(svc, archs, estate, body.use_ai)
    pipeline.append({"step": "validate", "label": "Validation & fit analysis",
                     "detail": f"Recommended: {next((a.name for a in archs if a.id == analysis['recommended_option_id']), '—')}"})
    return {"options": [a.model_dump() for a in archs], "analysis": analysis, "pipeline": pipeline,
            "citations": [h.citation.model_dump() for h in hits]}


class AnalyseBody(BaseModel):
    options: list[Architecture]
    estate: Estate
    use_ai: bool = False


@router.post("/analyse-options")
async def analyse_options(body: AnalyseBody, svc: Services = Depends(services)):
    """Re-score existing options (after edits or new what-if branches)."""
    for i, a in enumerate(body.options):
        a.meta.label = a.meta.label or "ABCDEF"[i % 6]
    return await _analysis(svc, body.options, body.estate, body.use_ai)
