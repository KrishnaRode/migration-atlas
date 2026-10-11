"""Compact text renderings of architectures and ontology facts for prompts.

Small local models have small context windows; these renderings favour ids and short lines.
"""

from __future__ import annotations

from atlas.models.architecture import Architecture, ValidationReport
from atlas.models.knowledge import SearchHit
from atlas.models.project import Estate
from atlas.ontology.service import OntologyService


def node_name(arch: Architecture, node_id: str, ontology: OntologyService) -> str:
    n = arch.node(node_id)
    if not n:
        return node_id
    tech = ontology.get(n.tech_id)
    return n.label or (tech.name if tech else n.tech_id)


def render_architecture(arch: Architecture, ontology: OntologyService, max_edges: int = 40, compact: bool = False) -> str:
    lines = [f"Name: {arch.name}"]
    if arch.meta.target_cloud or arch.meta.data_platform:
        lines.append(f"Target: cloud={arch.meta.target_cloud} platform={arch.meta.data_platform}")
    lines.append("Components:")
    for n in arch.nodes:
        tech = ontology.get(n.tech_id)
        role = tech.role if tech else "unknown"
        extra = []
        if n.environment:
            extra.append(n.environment)
        if n.strategy or n.suggested_strategy:
            extra.append(f"strategy={n.strategy or n.suggested_strategy}")
        if n.replaces:
            extra.append("replaces " + ", ".join(n.replaces))
        if compact:
            lines.append(f"- {node_name(arch, n.id, ontology)} ({role}{'; ' + '; '.join(extra[1:]) if len(extra) > 1 else ''})")
        else:
            lines.append(f"- {n.tech_id} \"{node_name(arch, n.id, ontology)}\" ({role}{'; ' + '; '.join(extra) if extra else ''})")
    lines.append("Connections:")
    edges = arch.edges
    if compact:
        # Data flows carry the meaning; cross-cutting wiring is summarised by the component list above.
        edges = [e for e in arch.edges if e.kind in {"data", "control"}]
        max_edges = min(max_edges, 24)
    for e in edges[:max_edges]:
        meta = ", ".join(x for x in [e.kind, e.mode, e.label, e.status] if x)
        lines.append(f"- {node_name(arch, e.source, ontology)} -> {node_name(arch, e.target, ontology)} [{meta}]")
    if len(edges) > max_edges:
        lines.append(f"- ... {len(edges) - max_edges} more connections")
    if arch.architecture_notes:
        lines.append("Notes: " + " ".join(arch.architecture_notes[:5]))
    return "\n".join(lines)


def render_estate(estate: Estate | None, ontology: OntologyService) -> str:
    if not estate:
        return "Not provided."
    cur = ", ".join(ontology.get(t).name if ontology.get(t) else t for t in estate.current_technologies) or "unknown"
    tgt = ", ".join(ontology.get(t).name if ontology.get(t) else t for t in estate.target_platforms) or "unspecified"
    cons = ", ".join(f"{c.id} ({c.priority})" for c in estate.constraints) or "none stated"
    parts = [f"Current: {cur}", f"Target cloud: {estate.target_cloud or 'unspecified'}; platforms: {tgt}", f"Constraints: {cons}"]
    if estate.data_volume_tb:
        parts.append(f"Data volume: ~{estate.data_volume_tb:g} TB")
    if estate.description:
        parts.append(f"Description: {estate.description[:400]}")
    return "\n".join(parts)


def render_catalog(ontology: OntologyService, cloud: str | None, exclude_legacy: bool = True, limit: int = 140) -> str:
    rows = []
    for t in ontology.technologies.values():
        if exclude_legacy and t.legacy:
            continue
        if cloud and not t.runs_on(cloud) and t.role != "cloud-platform":
            continue
        rows.append(f"{t.id}: {t.name} — {t.role}")
    return "\n".join(rows[:limit])


def render_tech_facts(tech_id: str, ontology: OntologyService, brief: bool = False) -> str:
    t = ontology.get(tech_id)
    if not t:
        return ""
    lines = [
        f"{t.name} ({t.vendor}) — category {t.category}, role {t.role}. {t.description}",
        f"Capabilities: {', '.join(t.capabilities)}",
    ]
    if t.typical_legacy_use:
        lines.append(f"Typical use: {t.typical_legacy_use}")
    if t.possible_targets:
        lines.append("Common migration targets: " + ", ".join(ontology.get(x).name for x in t.possible_targets if ontology.get(x)))
    if t.alternatives:
        lines.append("Alternatives: " + ", ".join(ontology.get(x).name for x in t.alternatives if ontology.get(x)))
    if t.migration_considerations:
        lines.append("Migration considerations: " + " | ".join(t.migration_considerations[: 2 if brief else 4]))
    if t.known_challenges and not brief:
        lines.append("Known challenges: " + " | ".join(t.known_challenges[:3]))
    return "\n".join(lines)


def render_sources(hits: list[SearchHit], max_chars: int = 700) -> str:
    if not hits:
        return "None retrieved."
    out = []
    for i, h in enumerate(hits, 1):
        text = " ".join(h.text.split())[:max_chars]
        out.append(f"[S{i}] {h.citation.vendor} — {h.citation.title}: {text}")
    return "\n".join(out)


def render_findings(report: ValidationReport | None, limit: int = 8) -> str:
    if not report or not report.findings:
        return "No validation findings."
    return "\n".join(f"- {f.severity.upper()}: {f.title}" for f in report.findings[:limit])
