"""Natural-language estate intake: deterministic extraction first, local AI second.

Deterministic matching against ontology aliases is fast and never hallucinates; the model only
adds what the rules missed, and every id it returns is checked against the ontology.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

from atlas.ai.ollama import AIUnavailable, OllamaClient
from atlas.ai.parsing import parse_model
from atlas.ai.prompts import ESTATE_PROMPT, ESTATE_SYSTEM
from atlas.models.project import Estate, MigrationConstraint, ParsedEstate
from atlas.ontology.service import OntologyService

TARGET_CUES = re.compile(
    r"\b(move|moving|migrate|migrating|migration to|modernize to|modernise to|target|targeting|land(?:ing)? on|adopt|"
    r"into|onto|to the cloud|want to use|go to|shift to|replatform to|towards)\b",
    re.I,
)
VOLUME = re.compile(r"(\d+(?:[.,]\d+)?)\s*(pb|tb|gb)\b", re.I)
INDUSTRIES = {
    "retail": "Retail", "bank": "Banking", "banking": "Banking", "insurance": "Insurance", "telecom": "Telecom",
    "healthcare": "Healthcare", "pharma": "Life Sciences", "manufacturing": "Manufacturing", "energy": "Energy",
    "utilities": "Utilities", "government": "Public Sector", "public sector": "Public Sector", "logistics": "Logistics",
    "airline": "Travel", "media": "Media", "fintech": "Financial Services", "financial": "Financial Services",
}
PRIORITY_WORDS = [("critical", re.compile(r"\b(must|critical|mandatory|non-negotiable|zero)\b", re.I)),
                  ("high", re.compile(r"\b(minimi[sz](?:e|ing)|minimal|strict|important|key|required|need)\b", re.I))]


class _AIEstate(BaseModel):
    current: list[str] = Field(default_factory=list)
    targets: list[str] = Field(default_factory=list)
    constraints: list[dict] = Field(default_factory=list)
    data_volume_tb: float | None = None
    industry: str | None = None


def _clauses(text: str) -> list[tuple[int, str]]:
    out, pos = [], 0
    for part in re.split(r"(?<=[.;!?\n])|\bbut\b|\bwhile\b", text):
        if part is None:
            continue
        idx = text.find(part, pos)
        out.append((max(idx, 0), part))
        pos = max(idx, 0) + len(part)
    return out


class EstateParser:
    def __init__(self, ontology: OntologyService, ollama: OllamaClient | None = None):
        self.ontology = ontology
        self.ollama = ollama

    def parse_rules(self, text: str) -> ParsedEstate:
        estate = Estate(description=text.strip())
        detected: list[dict] = []
        clauses = _clauses(text)

        def clause_for(offset: int) -> str:
            chosen = ""
            for start, clause in clauses:
                if start <= offset:
                    chosen = clause
            return chosen

        for tech_id, phrase, offset in self.ontology.match_aliases(text):
            tech = self.ontology.require(tech_id)
            clause = clause_for(offset)
            cue = TARGET_CUES.search(clause)
            # A mention after a target cue in the same clause is a target; modern tech mentioned
            # without context leans target too, legacy tech leans current.
            is_target = bool(cue and cue.start() < (offset - text.find(clause))) or (
                not tech.legacy and tech.role in {"cloud-platform", "lakehouse", "warehouse"} and not cue is None
            )
            if tech.legacy:
                is_target = False
            if tech.role == "cloud-platform" and (cue or not tech.legacy):
                is_target = True
            role = "target" if is_target else "current"
            detected.append({"tech_id": tech_id, "name": tech.name, "matched": phrase, "role": role, "source": "rules"})
            if role == "target":
                if tech.role == "cloud-platform":
                    estate.target_cloud = estate.target_cloud or tech_id
                else:
                    estate.target_platforms.append(tech_id)
            else:
                estate.current_technologies.append(tech_id)

        lowered = text.lower()
        if not estate.target_cloud:
            # Clouds are often embedded in product phrases ("Azure Databricks", "BigQuery on Google Cloud")
            # that the longest-match alias pass consumed as a single technology.
            found = []
            for cloud_id in ("gcp", "aws", "azure"):
                cloud = self.ontology.get(cloud_id)
                if not cloud:
                    continue
                phrases = {cloud.name.lower(), cloud_id, *[a.lower() for a in cloud.aliases]}
                if any(re.search(r"(?<![a-z0-9])" + re.escape(p) + r"(?![a-z0-9])", lowered) for p in phrases if len(p) > 2):
                    found.append(cloud_id)
            if len(found) == 1 and TARGET_CUES.search(text):
                estate.target_cloud = found[0]
                detected.append({"tech_id": found[0], "name": self.ontology.require(found[0]).name, "matched": found[0],
                                 "role": "target", "source": "rules"})
        for cdef in self.ontology.data.constraints.values():
            for kw in sorted(cdef.keywords, key=len, reverse=True):
                m = re.search(r"(?<![a-z0-9])" + re.escape(kw.lower()) + r"(?![a-z0-9])", lowered)
                if not m:
                    continue
                window = lowered[max(0, m.start() - 40): m.end() + 20]
                priority = "medium"
                for level, rx in PRIORITY_WORDS:
                    if rx.search(window):
                        priority = level
                        break
                if cdef.id not in {c.id for c in estate.constraints}:
                    estate.constraints.append(MigrationConstraint(id=cdef.id, priority=priority))  # type: ignore[arg-type]
                break
        # "real time" also matches inside "near real time"; downtime cue words should not imply streaming.
        vol = VOLUME.search(text)
        if vol:
            value = float(vol.group(1).replace(",", ""))
            unit = vol.group(2).lower()
            estate.data_volume_tb = value * 1000 if unit == "pb" else value / 1000 if unit == "gb" else value
        for key, name in INDUSTRIES.items():
            if re.search(rf"\b{key}\b", lowered):
                estate.industry = name
                break
        return ParsedEstate(estate=estate, detected=detected)

    async def parse(self, text: str, use_ai: bool = True) -> ParsedEstate:
        result = self.parse_rules(text)
        if not use_ai or not self.ollama:
            return result
        catalog = "\n".join(f"{t.id}: {t.name}" for t in self.ontology.technologies.values())
        prompt = ESTATE_PROMPT.format(
            catalog=catalog, constraints=", ".join(self.ontology.data.constraints), text=text[:2000]
        )
        try:
            raw, model = await self.ollama.generate_json(ESTATE_SYSTEM, prompt, num_predict=500)
        except AIUnavailable as exc:
            result.ai_note = f"Local AI skipped: {exc.message} Extraction used ontology rules only."
            return result
        parsed, err = parse_model(raw, _AIEstate)
        if not parsed:
            result.ai_note = f"Local AI answer was unusable ({err}); extraction used ontology rules only."
            return result
        est = result.estate
        known = {d["tech_id"] for d in result.detected}
        # The model may only add ids it found that the rules missed, and only if the id is real.
        for tid in parsed.current:
            if self.ontology.exists(tid) and tid not in known:
                est.current_technologies.append(tid)
                known.add(tid)
                result.detected.append({"tech_id": tid, "name": self.ontology.require(tid).name, "matched": None, "role": "current", "source": "ai"})
        for tid in parsed.targets:
            if self.ontology.exists(tid) and tid not in known:
                tech = self.ontology.require(tid)
                if tech.role == "cloud-platform":
                    est.target_cloud = est.target_cloud or tid
                else:
                    est.target_platforms.append(tid)
                known.add(tid)
                result.detected.append({"tech_id": tid, "name": tech.name, "matched": None, "role": "target", "source": "ai"})
        have = {c.id for c in est.constraints}
        for c in parsed.constraints:
            cid, pr = c.get("id"), c.get("priority", "medium")
            if cid in self.ontology.data.constraints and cid not in have and pr in {"low", "medium", "high", "critical"}:
                est.constraints.append(MigrationConstraint(id=cid, priority=pr))
                have.add(cid)
        if est.data_volume_tb is None and parsed.data_volume_tb:
            est.data_volume_tb = parsed.data_volume_tb
        est.industry = est.industry or parsed.industry
        result.ai_used = True
        result.ai_note = f"Extracted with ontology rules and refined by {model}."
        return result
