"""Loads and cross-checks the YAML ontology. Pure functions; no web or AI concerns."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from pydantic import ValidationError

from atlas.models.ontology import (
    Category,
    ConnectionRule,
    ConstraintDef,
    MigrationMapping,
    Pattern,
    Platforms,
    RiskDef,
    Strategy,
    Technology,
)

log = logging.getLogger(__name__)


@dataclass
class OntologyData:
    categories: list[Category] = field(default_factory=list)
    technologies: dict[str, Technology] = field(default_factory=dict)
    rules: list[ConnectionRule] = field(default_factory=list)
    default_rule: dict = field(default_factory=dict)
    platforms: Platforms = field(default_factory=Platforms)
    mappings: list[MigrationMapping] = field(default_factory=list)
    risks: dict[str, RiskDef] = field(default_factory=dict)
    strategies: dict[str, Strategy] = field(default_factory=dict)
    constraints: dict[str, ConstraintDef] = field(default_factory=dict)
    patterns: dict[str, Pattern] = field(default_factory=dict)
    problems: list[str] = field(default_factory=list)  # load-time integrity issues


def _read_yaml(path: Path):
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def _load_list(path: Path, model, problems: list[str]) -> list:
    if not path.exists():
        problems.append(f"missing file: {path.name}")
        return []
    raw = _read_yaml(path) or []
    out = []
    for i, item in enumerate(raw):
        try:
            out.append(model.model_validate(item))
        except ValidationError as exc:
            ident = item.get("id", f"#{i}") if isinstance(item, dict) else f"#{i}"
            problems.append(f"{path.name}:{ident}: {exc.errors()[0]['msg']} ({exc.errors()[0]['loc']})")
    return out


def load_ontology(ontology_dir: Path, patterns_dir: Path) -> OntologyData:
    data = OntologyData()
    problems = data.problems

    data.categories = _load_list(ontology_dir / "categories.yaml", Category, problems)

    for path in sorted((ontology_dir / "technologies").glob("*.yaml")):
        for tech in _load_list(path, Technology, problems):
            if tech.id in data.technologies:
                problems.append(f"duplicate technology id {tech.id} in {path.name}")
            data.technologies[tech.id] = tech

    rules_path = ontology_dir / "connection_rules.yaml"
    if rules_path.exists():
        raw = _read_yaml(rules_path) or {}
        data.default_rule = raw.get("default", {})
        for i, item in enumerate(raw.get("rules", [])):
            try:
                data.rules.append(ConnectionRule.model_validate(item))
            except ValidationError as exc:
                problems.append(f"connection_rules.yaml rule #{i}: {exc.errors()[0]['msg']}")

    platforms_path = ontology_dir / "platforms.yaml"
    if platforms_path.exists():
        data.platforms = Platforms.model_validate(_read_yaml(platforms_path) or {})

    data.mappings = _load_list(ontology_dir / "mappings.yaml", MigrationMapping, problems)
    data.risks = {r.id: r for r in _load_list(ontology_dir / "risks.yaml", RiskDef, problems)}
    data.strategies = {s.id: s for s in _load_list(ontology_dir / "strategies.yaml", Strategy, problems)}
    data.constraints = {c.id: c for c in _load_list(ontology_dir / "constraints.yaml", ConstraintDef, problems)}

    for path in sorted(patterns_dir.glob("*.yaml")):
        try:
            pattern = Pattern.model_validate(_read_yaml(path))
            data.patterns[pattern.id] = pattern
        except ValidationError as exc:
            problems.append(f"pattern {path.name}: {exc.errors()[0]['msg']}")

    problems.extend(check_integrity(data))
    for p in problems:
        log.warning("ontology: %s", p)
    return data


def check_integrity(data: OntologyData) -> list[str]:
    """Dangling references make suggestions and the generator silently weaker, so surface them."""
    issues: list[str] = []
    techs = data.technologies
    category_ids = {c.id for c in data.categories}
    for t in techs.values():
        if category_ids and t.category not in category_ids:
            issues.append(f"{t.id}: unknown category {t.category}")
        for fld in ("possible_targets", "alternatives", "replaces", "suggested_next"):
            for ref in getattr(t, fld):
                if ref not in techs:
                    issues.append(f"{t.id}.{fld}: unknown technology {ref}")
        if data.risks:
            for r in t.risks:
                if r not in data.risks:
                    issues.append(f"{t.id}.risks: unknown risk {r}")
        if data.strategies:
            for s in t.strategies:
                if s not in data.strategies:
                    issues.append(f"{t.id}.strategies: unknown strategy {s}")
    for m in data.mappings:
        for ref in [m.source, *m.targets]:
            if ref not in techs:
                issues.append(f"mapping {m.id}: unknown technology {ref}")
    for p in data.patterns.values():
        keys = {n.key for n in p.template.nodes}
        for n in p.template.nodes:
            if n.tech not in techs:
                issues.append(f"pattern {p.id}: unknown technology {n.tech}")
        for e in p.template.edges:
            if e.from_ not in keys or e.to not in keys:
                issues.append(f"pattern {p.id}: edge {e.from_}->{e.to} references unknown node")
    for block_name, blocks in [*data.platforms.clouds.items(), *data.platforms.data_platforms.items()]:
        for key, value in blocks.model_dump().items():
            if key in {"name", "clouds", "kind"}:
                continue
            for ref in value if isinstance(value, list) else [value]:
                if isinstance(ref, str) and ref not in techs:
                    issues.append(f"platforms.{block_name}.{key}: unknown technology {ref}")
    return issues
