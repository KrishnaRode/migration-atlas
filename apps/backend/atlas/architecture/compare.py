"""Descriptive comparison of architecture options. Deliberately no 'winner'."""

from __future__ import annotations

from collections import Counter

from atlas.models.architecture import Architecture
from atlas.models.ontology import LAYERS
from atlas.ontology.service import OntologyService
from atlas.rules.validator import Validator


class ArchitectureComparer:
    def __init__(self, ontology: OntologyService, validator: Validator):
        self.ontology = ontology
        self.validator = validator

    def describe(self, arch: Architecture, estate=None) -> dict:
        techs = [(n, self.ontology.get(n.tech_id)) for n in arch.nodes]
        techs = [(n, t) for n, t in techs if t]
        by_layer: dict[str, list[str]] = {layer: [] for layer in LAYERS}
        for n, t in techs:
            by_layer.setdefault(n.layer or t.layer, []).append(n.label or t.name)
        op_model = Counter(t.operational_model for n, t in techs if not t.legacy)
        rewrite, automation = [], []
        for n, t in techs:
            for old in n.replaces:
                maps = self.ontology.mappings_between(old, t.id) or self.ontology.mappings_for(old)
                old_name = self.ontology.get(old).name if self.ontology.get(old) else old
                pot = maps[0].automation_potential if maps else "unknown"
                rewrite.append({"from": old_name, "to": n.label or t.name, "automation_potential": pot,
                                "manual_effort": maps[0].manual_effort_areas[:3] if maps else []})
                automation.append(pot)
        retained = [n.label or t.name for n, t in techs if t.legacy]
        skills: list[str] = []
        for n, t in techs:
            if not t.legacy:
                skills.extend(s for s in t.skills if s not in skills)
        governance = [n.label or t.name for n, t in techs if t.role == "governance"]
        vendors = sorted({t.vendor for n, t in techs if not t.legacy})
        report = self.validator.validate(arch, estate)
        clouds = sorted({c for n, t in techs for c in t.clouds if c in {"gcp", "aws", "azure"} and len(t.clouds) == 1})
        complexity_drivers = []
        if len(arch.nodes) > 18:
            complexity_drivers.append(f"{len(arch.nodes)} components to operate")
        if len(vendors) > 5:
            complexity_drivers.append(f"{len(vendors)} vendors in the target state")
        if op_model.get("self-managed"):
            complexity_drivers.append(f"{op_model['self-managed']} self-managed component(s)")
        if retained:
            complexity_drivers.append(f"Coexistence with {len(retained)} retained legacy component(s)")
        if any(t.role == "streaming" for n, t in techs):
            complexity_drivers.append("Streaming backbone to operate")
        return {
            "id": arch.id,
            "name": arch.name,
            "target_cloud": arch.meta.target_cloud,
            "data_platform": arch.meta.data_platform,
            "component_count": len(arch.nodes),
            "connection_count": len(arch.edges),
            "components_by_layer": {k: v for k, v in by_layer.items() if v},
            "operational_model": dict(op_model),
            "rewrite_areas": rewrite,
            "automation_mix": dict(Counter(automation)),
            "retained_legacy": retained,
            "governance_approach": governance or ["No explicit governance component"],
            "skills_needed": skills[:14],
            "vendors": vendors,
            "cloud_dependencies": clouds,
            "complexity_drivers": complexity_drivers or ["Compact design with few moving parts"],
            "risks": [r.title for r in arch.risks][:8],
            "validation": {"counts": report.counts, "top": [f.title for f in report.findings[:5]]},
            "health": [{"id": h.id, "name": h.name, "level": h.level, "summary": h.summary} for h in report.health],
        }

    def compare(self, options: list[Architecture], estate=None) -> dict:
        described = [self.describe(a, estate) for a in options]
        tech_sets = {a.id: {n.tech_id for n in a.nodes} for a in options}
        common = set.intersection(*tech_sets.values()) if tech_sets else set()
        for d in described:
            unique = tech_sets[d["id"]] - set().union(*(s for k, s in tech_sets.items() if k != d["id"]))
            d["unique_components"] = sorted(self.ontology.get(t).name for t in unique if self.ontology.get(t))
        return {
            "options": described,
            "shared_components": sorted(self.ontology.get(t).name for t in common if self.ontology.get(t)),
            "dimensions": ["components", "rewrite areas", "operational model", "governance approach", "skills",
                           "complexity drivers", "dependencies", "risks", "health"],
        }
