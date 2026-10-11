"""What-if analysis: interpret a scenario, derive a modified estate, branch a new option.

The original architecture is never modified — every what-if produces a new branch.
"""

from __future__ import annotations

import re

from atlas.models.project import Estate, MigrationConstraint
from atlas.ontology.service import OntologyService

RETAIN = re.compile(r"\b(retain|retaining|keep|keeping|stay on|stick with)\b", re.I)
AVOID = re.compile(r"\b(avoid|avoiding|without|no|drop|remove|exclude|not use|instead of)\b", re.I)
DOWNTIME = re.compile(r"downtime[^.]*?(\d+)\s*(min|minute|minutes|hour|hours|h)\b", re.I)


def _set_constraint(estate: Estate, cid: str, priority: str) -> None:
    for c in estate.constraints:
        if c.id == cid:
            c.priority = priority  # type: ignore[assignment]
            return
    estate.constraints.append(MigrationConstraint(id=cid, priority=priority))  # type: ignore[arg-type]


def interpret_what_if(question: str, estate: Estate, ontology: OntologyService) -> tuple[Estate, list[str]]:
    """Return (modified estate, human-readable list of interpreted changes). Empty list = not understood."""
    out = estate.model_copy(deep=True)
    changes: list[str] = []
    data_platforms = ontology.data.platforms.data_platforms
    clouds = ontology.data.platforms.clouds
    lowered = question.lower()
    for tech_id, phrase, offset in ontology.match_aliases(question):
        tech = ontology.require(tech_id)
        before = lowered[max(0, offset - 30):offset]
        if AVOID.search(before) and not RETAIN.search(before):
            if tech_id not in out.exclude_technologies:
                out.exclude_technologies.append(tech_id)
                # Avoiding a product usually means avoiding its managed variants too.
                for t in ontology.technologies.values():
                    if tech_id in t.alternatives and t.role == tech.role and t.vendor == tech.vendor:
                        out.exclude_technologies.append(t.id)
                if tech_id in out.target_platforms:
                    out.target_platforms.remove(tech_id)
                changes.append(f"Avoid {tech.name}")
            continue
        if RETAIN.search(before):
            if tech_id not in out.retain_technologies:
                out.retain_technologies.append(tech_id)
                if tech_id not in out.current_technologies:
                    out.current_technologies.append(tech_id)
                changes.append(f"Retain {tech.name}")
            continue
        if tech_id in clouds:
            if out.target_cloud != tech_id:
                out.target_cloud = tech_id
                changes.append(f"Target cloud → {clouds[tech_id].name}")
                # Keep data platforms only if they run on the new cloud.
                out.target_platforms = [p for p in out.target_platforms
                                        if p not in data_platforms or tech_id in data_platforms[p].clouds]
            continue
        if tech_id in data_platforms:
            out.target_platforms = [p for p in out.target_platforms if p not in data_platforms]
            out.target_platforms.insert(0, tech_id)
            block = data_platforms[tech_id]
            if out.target_cloud and out.target_cloud not in block.clouds:
                out.target_cloud = block.clouds[0]
                changes.append(f"Target cloud → {clouds[out.target_cloud].name} (required by {block.name})")
            changes.append(f"Data platform → {block.name}")
            continue
        if not tech.legacy and tech_id not in out.target_platforms:
            out.target_platforms.append(tech_id)
            changes.append(f"Include {tech.name}")

    m = DOWNTIME.search(question)
    if m:
        minutes = int(m.group(1)) * (60 if m.group(2).lower().startswith("h") else 1)
        _set_constraint(out, "minimize-downtime", "critical")
        changes.append(f"Downtime budget {minutes} minutes → CDC-based cutover")
        if minutes <= 60:
            _set_constraint(out, "near-real-time", "high")
            changes.append("Continuous replication required")
    elif "downtime" in lowered:
        _set_constraint(out, "minimize-downtime", "critical")
        changes.append("Minimise downtime")
    if re.search(r"\b(real[- ]time|streaming|event)", lowered) and not AVOID.search(lowered[:lowered.find("real") if "real" in lowered else 0]):
        _set_constraint(out, "near-real-time", "high")
        changes.append("Near-real-time ingestion")
    if re.search(r"\b(cheaper|lower[- ]cost|cost|licen[cs]e)", lowered):
        _set_constraint(out, "reduce-licensing", "high")
        _set_constraint(out, "maximize-managed", "medium")
        changes.append("Reduce licensing cost")
    if re.search(r"lock[- ]?in|open[- ]source|portable", lowered):
        _set_constraint(out, "avoid-lock-in", "high")
        changes.append("Avoid vendor lock-in")
    if re.search(r"\b(dr|disaster)\b", lowered):
        _set_constraint(out, "disaster-recovery", "high")
        changes.append("Disaster recovery required")
    if re.search(r"rewrite", lowered):
        _set_constraint(out, "minimize-rewrite", "high")
        changes.append("Minimise rewrite")
    return out, list(dict.fromkeys(changes))
