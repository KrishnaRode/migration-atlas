"""Report assembly shared by Markdown and PDF exports."""

from __future__ import annotations

from dataclasses import dataclass, field

from atlas.models.architecture import Architecture, ValidationReport
from atlas.models.knowledge import Citation
from atlas.models.project import ArchitectureDecision, Project, Roadmap
from atlas.ontology.service import OntologyService


@dataclass
class ReportData:
    project: Project
    architecture: Architecture
    validation: ValidationReport
    roadmap: Roadmap | None
    citations: list[Citation] = field(default_factory=list)
    executive_summary: str = ""
    diagram_png: bytes | None = None


def node_name(arch: Architecture, node_id: str, ontology: OntologyService) -> str:
    n = arch.node(node_id)
    if not n:
        return node_id
    t = ontology.get(n.tech_id)
    return n.label or (t.name if t else n.tech_id)


def default_summary(data: ReportData, ontology: OntologyService) -> str:
    p, a = data.project, data.architecture
    current = ", ".join(ontology.get(t).name for t in p.estate.current_technologies if ontology.get(t)) or "the legacy estate"
    platform = ontology.get(a.meta.data_platform or "")
    cloud = ontology.data.platforms.clouds.get(a.meta.target_cloud or "")
    target = f"{platform.name if platform else 'a modern data platform'}" + (f" on {cloud.name}" if cloud else "")
    sev = data.validation.counts
    waves = [w for w in (data.roadmap.waves if data.roadmap else []) if w.included]
    parts = [
        f"{p.name} modernises {current} onto {target}.",
        f"The proposed architecture has {len(a.nodes)} components and {len(a.edges)} connections.",
    ]
    if data.roadmap and data.roadmap.themes:
        parts.append("Key themes: " + "; ".join(data.roadmap.themes[:4]) + ".")
    if waves:
        parts.append(f"The roadmap runs across {len(waves)} waves from discovery to decommissioning.")
    open_high = sev.get("critical", 0) + sev.get("high", 0)
    parts.append(f"Validation reports {open_high} critical/high finding(s) to resolve before build." if open_high
                 else "Validation reports no critical or high findings.")
    return " ".join(parts)


def mapping_rows(data: ReportData, ontology: OntologyService) -> list[dict]:
    rows = []
    for n in data.architecture.nodes:
        for old in n.replaces:
            maps = ontology.mappings_between(old, n.tech_id) or ontology.mappings_for(old)
            old_t = ontology.get(old)
            rows.append({
                "source": old_t.name if old_t else old,
                "target": node_name(data.architecture, n.id, ontology),
                "approach": maps[0].approaches[0] if maps and maps[0].approaches else "",
                "automation": maps[0].automation_potential if maps else "—",
                "risks": ", ".join(ontology.data.risks[r].title for r in (maps[0].risks if maps else []) if r in ontology.data.risks),
            })
    for n in data.architecture.nodes:
        t = ontology.get(n.tech_id)
        if t and t.legacy and not any(r["source"] == t.name for r in rows):
            rows.append({"source": t.name, "target": f"Strategy: {n.strategy or n.suggested_strategy or 'not set'}",
                         "approach": "", "automation": "—", "risks": ""})
    return rows


def adr_markdown(adr: ArchitectureDecision) -> str:
    lines = [f"# ADR-{adr.number:03d}: {adr.title}", "", f"**Status:** {adr.status.capitalize()}  ", f"**Date:** {adr.created_at[:10]}", "",
             "## Context", "", adr.context or "_Not recorded._", "", "## Decision", "", adr.decision or "_Not recorded._", ""]
    if adr.alternatives:
        lines += ["## Alternatives considered", "", *[f"- {a}" for a in adr.alternatives], ""]
    if adr.consequences:
        lines += ["## Consequences", "", *[f"- {c}" for c in adr.consequences], ""]
    return "\n".join(lines)


def to_markdown(data: ReportData, ontology: OntologyService) -> str:
    p, a = data.project, data.architecture
    md: list[str] = [f"# {p.name}", "", f"_Migration Atlas report · {a.name}_", ""]
    md += ["## Executive Summary", "", data.executive_summary or default_summary(data, ontology), ""]

    md += ["## Current Estate", ""]
    for tid in p.estate.current_technologies:
        t = ontology.get(tid)
        if t:
            cat = next((c.name for c in ontology.data.categories if c.id == t.category), t.category)
            md.append(f"- **{t.name}** ({cat}) — {t.typical_legacy_use or t.description}")
    if p.estate.constraints:
        md += ["", "**Constraints:** " + ", ".join(
            f"{ontology.data.constraints[c.id].name if c.id in ontology.data.constraints else c.id} ({c.priority})" for c in p.estate.constraints)]
    if p.estate.data_volume_tb:
        md.append(f"**Data volume:** ~{p.estate.data_volume_tb:g} TB")
    md.append("")

    md += ["## Target Architecture", ""]
    layers: dict[str, list[str]] = {}
    for n in a.nodes:
        t = ontology.get(n.tech_id)
        layers.setdefault(n.layer or (t.layer if t else "other"), []).append(node_name(a, n.id, ontology))
    for layer, names in layers.items():
        md.append(f"- **{layer.capitalize()}:** {', '.join(names)}")
    md += ["", "### Data flows", ""]
    for e in a.edges:
        if e.kind == "data":
            meta = ", ".join(x for x in [e.label, e.mode, e.frequency, e.latency] if x)
            md.append(f"- {node_name(a, e.source, ontology)} → {node_name(a, e.target, ontology)}" + (f" ({meta})" if meta else ""))
    md += ["", "## Architecture Diagram", "", "_See the PNG/SVG export or the PDF report for the rendered diagram._", ""]

    md += ["## Technology Mapping", "", "| Source | Target | Approach | Automation | Key risks |", "| --- | --- | --- | --- | --- |"]
    for r in mapping_rows(data, ontology):
        md.append(f"| {r['source']} | {r['target']} | {r['approach']} | {r['automation']} | {r['risks']} |")
    md.append("")

    md += ["## Key Decisions", ""]
    if p.decisions:
        md += [f"- **ADR-{d.number:03d}** {d.title} — _{d.status}_" for d in p.decisions]
    md += [f"- {note}" for note in a.architecture_notes]
    md.append("")
    md += ["## Assumptions", "", *[f"- {x}" for x in a.assumptions], ""]
    md += ["## Risks", ""]
    for r in a.risks:
        md.append(f"- **{r.severity.upper()}** {r.title}" + (f" — {r.detail}" if r.detail else ""))
    md.append("")

    md += ["## Migration Strategy", ""]
    for n in a.nodes:
        t = ontology.get(n.tech_id)
        if t and t.legacy:
            strat = n.strategy or n.suggested_strategy
            name = ontology.data.strategies[strat].name if strat in ontology.data.strategies else (strat or "not set")
            md.append(f"- **{t.name}:** {name}" + ("" if n.strategy else " _(suggested)_"))
    md.append("")

    md += ["## Migration Roadmap", ""]
    if data.roadmap:
        if data.roadmap.narrative:
            md += [data.roadmap.narrative, ""]
        for w in data.roadmap.waves:
            if not w.included:
                continue
            md += [f"### Wave {w.index} — {w.name}", "", f"_{w.goal}_", ""]
            md += [f"- {it.title}" + (f" — {it.detail}" if it.detail else "") for it in w.activities]
            if w.exit_criteria:
                md += ["", "Exit criteria: " + "; ".join(w.exit_criteria)]
            md.append("")
    else:
        md += ["_Roadmap not generated yet._", ""]

    md += ["## Validation Findings", ""]
    for f in data.validation.findings:
        md.append(f"- **{f.severity.upper()}** [{f.category}] {f.title} — {f.detail}")
    md += ["", "### Architecture health", ""]
    for h in data.validation.health:
        md.append(f"- **{h.name}:** {h.level} ({h.summary})")
    md.append("")

    md += ["## Documentation References", ""]
    seen = set()
    for c in data.citations:
        if c.url in seen:
            continue
        seen.add(c.url)
        md.append(f"- {c.vendor} — [{c.title}]({c.url}) (retrieved {c.retrieved_at[:10]})")
    if not data.citations:
        md.append("_No documentation references were attached._")
    md += ["", "---", "_Generated locally by Migration Atlas. Architecture data never left this machine._", ""]
    return "\n".join(md)
