"""Alternative target architectures and priority-fit analysis.

A migration rarely has one answer. From one estate we derive a few genuinely different
candidates (the requested target, an alternative data platform on the same cloud, a
low-rewrite coexistence path, an open/portable variant), then score each against the user's
weighted priorities with the evidence behind every score. The LLM may recommend a best fit,
but the scores and evidence are deterministic and always shown.
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, Field

from atlas.architecture.generator import ArchitectureGenerator
from atlas.models.architecture import Architecture
from atlas.models.project import PRIORITY_WEIGHT, Estate, MigrationConstraint
from atlas.ontology.service import OntologyService
from atlas.rules.validator import Validator

PLATFORM_PREFERENCE = {
    "gcp": ["databricks", "bigquery", "snowflake"],
    "aws": ["databricks", "amazon-redshift", "snowflake"],
    "azure": ["databricks", "microsoft-fabric", "snowflake", "azure-synapse"],
}
OPEN_VENDORS = {"apache software foundation", "linux foundation", "dbt labs", "delta lake", "cncf", "open source",
                "the linux foundation", "debezium", "postgresql", "grafana labs", "prometheus", "opentelemetry"}
SQL_FIRST = {"dbt", "dataform", "databricks-sql", "bigquery", "snowflake", "amazon-redshift", "azure-synapse",
             "microsoft-fabric", "lakeflow-declarative-pipelines"}
DEFAULT_PRIORITIES = [("minimize-downtime", "medium"), ("maximize-managed", "medium"), ("minimize-rewrite", "medium")]
# Always scored at low weight so options differ even when few priorities are stated.
BASELINE = ["minimize-rewrite", "maximize-managed", "avoid-lock-in", "reduce-licensing", "retain-skills"]
LETTERS = "ABCDEF"


class CriterionScore(BaseModel):
    id: str
    name: str
    priority: str
    score: int  # 0..3
    evidence: str
    baseline: bool = False  # not stated by the user; scored at low weight for context


class OptionFit(BaseModel):
    option_id: str
    label: str
    name: str
    variant: str
    summary: str
    fit_percent: int
    criteria: list[CriterionScore] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    trade_offs: list[str] = Field(default_factory=list)
    component_count: int = 0
    high_findings: int = 0


class OptionAnalysis(BaseModel):
    fits: list[OptionFit] = Field(default_factory=list)
    recommended_option_id: str | None = None
    headline: str = ""
    rationale: str = ""
    choose_when: dict[str, str] = Field(default_factory=dict)  # option_id -> when to choose it
    caveats: list[str] = Field(default_factory=list)
    decided_by: str = "rules"  # "rules" or "rules+ai:<model>"
    priorities_assumed: bool = False


@dataclass
class Variant:
    key: str
    estate: Estate
    summary: str


def _tech_set(arch: Architecture) -> set[str]:
    return {n.tech_id for n in arch.nodes}


def _similar(a: Architecture, b: Architecture, strategy_variant: bool = False) -> bool:
    """Platform swaps must differ substantially; a strategy variant (e.g. low-rewrite) only needs to differ at all."""
    sa, sb = _tech_set(a), _tech_set(b)
    if strategy_variant:
        return sa == sb
    return len(sa & sb) / max(1, len(sa | sb)) > 0.88


class OptionPlanner:
    def __init__(self, ontology: OntologyService, generator: ArchitectureGenerator, validator: Validator):
        self.ontology = ontology
        self.generator = generator
        self.validator = validator

    # ------------------------------------------------------------------ variants
    def variants(self, estate: Estate) -> list[Variant]:
        t = self.generator.resolve_targets(estate)
        cloud, platform = t.cloud_id, t.platform_id
        out = [Variant("requested", estate, f"The requested target: {t.platform.name} on {t.cloud.name}.")]

        for alt in PLATFORM_PREFERENCE.get(cloud, []):
            block = self.ontology.data.platforms.data_platforms.get(alt)
            if alt == platform or not block or cloud not in block.clouds:
                continue
            e = estate.model_copy(deep=True)
            e.target_cloud = cloud
            e.target_platforms = [alt] + [p for p in e.target_platforms if p not in self.ontology.data.platforms.data_platforms]
            out.append(Variant(f"platform:{alt}", e, f"Same cloud, different data platform: {block.name} on {t.cloud.name}."))
            break  # one alternative platform; the other slots go to genuinely different strategies

        legacy_keep = [tid for tid in estate.current_technologies
                       if (x := self.ontology.get(tid)) and x.legacy and x.role in {"etl", "orchestrator", "bi"}]
        if legacy_keep:
            e = estate.model_copy(deep=True)
            e.retain_technologies = list(dict.fromkeys([*e.retain_technologies, *legacy_keep]))
            e.constraints = [c for c in e.constraints if c.id != "minimize-rewrite"] + [MigrationConstraint(id="minimize-rewrite", priority="high")]
            names = ", ".join(self.ontology.require(x).name for x in legacy_keep)
            out.append(Variant("coexistence", e, f"Low-rewrite coexistence: keep {names} running against the new platform first, modernize later."))

        e = estate.model_copy(deep=True)
        e.constraints = [c for c in e.constraints if c.id != "avoid-lock-in"] + [MigrationConstraint(id="avoid-lock-in", priority="high")]
        if platform != "databricks" and "databricks" in PLATFORM_PREFERENCE.get(cloud, []):
            e.target_platforms = ["databricks"]
        out.append(Variant("open", e, "Open and portable: open table formats, open-source streaming and SQL-first transformations."))
        # Further platform alternatives as fallbacks when a strategy variant collapses into an existing option.
        for alt in PLATFORM_PREFERENCE.get(cloud, []):
            block = self.ontology.data.platforms.data_platforms.get(alt)
            if alt == platform or not block or cloud not in block.clouds or any(v.key == f"platform:{alt}" for v in out):
                continue
            e = estate.model_copy(deep=True)
            e.target_cloud = cloud
            e.target_platforms = [alt]
            out.append(Variant(f"platform:{alt}", e, f"Same cloud, different data platform: {block.name} on {t.cloud.name}."))
        return out

    def build(self, estate: Estate, count: int = 3) -> list[Architecture]:
        options: list[Architecture] = []
        for v in self.variants(estate):
            arch = self.generator.generate(v.estate)
            if any(_similar(arch, o, strategy_variant=not v.key.startswith("platform:")) for o in options):
                continue
            arch.meta.variant = v.key
            arch.meta.summary = v.summary
            options.append(arch)
            if len(options) >= count:
                break
        for i, arch in enumerate(options):
            arch.meta.label = LETTERS[i]
            base = arch.name
            suffix = {"coexistence": " · low-rewrite", "open": " · open & portable"}.get(arch.meta.variant or "", "")
            arch.name = f"Option {LETTERS[i]} · {base}{suffix}"
        return options

    # ------------------------------------------------------------------ fit
    def _criteria(self, estate: Estate) -> tuple[list[tuple[str, str, bool]], bool]:
        stated = [(c.id, c.priority, False) for c in estate.constraints]
        assumed = not stated
        if assumed:
            stated = [(cid, pr, False) for cid, pr in DEFAULT_PRIORITIES]
        ids = {c[0] for c in stated}
        if "open-architecture" in ids:
            ids.add("avoid-lock-in")
        return stated + [(cid, "low", True) for cid in BASELINE if cid not in ids], assumed

    def score(self, arch: Architecture, estate: Estate) -> OptionFit:
        techs = [(n, self.ontology.get(n.tech_id)) for n in arch.nodes]
        techs = [(n, t) for n, t in techs if t]
        roles = {t.role for _, t in techs}
        modern = [(n, t) for n, t in techs if not t.legacy]
        legacy = [(n, t) for n, t in techs if t.legacy]
        report = self.validator.validate(arch, estate)
        health = {h.id: h.level for h in report.health}
        level_score = {"strong": 3, "partial": 2, "weak": 1, "not-assessed": 1}

        def names(items):
            return ", ".join(sorted({n.label or t.name for n, t in items})[:3])

        def rewrites():
            out = []
            for n, t in techs:
                for old in n.replaces:
                    maps = self.ontology.mappings_between(old, t.id) or self.ontology.mappings_for(old)
                    out.append((old, maps[0].automation_potential if maps else "medium"))
            return out

        crit: list[CriterionScore] = []
        criteria, assumed = self._criteria(estate)
        for cid, priority, baseline in criteria:
            cdef = self.ontology.data.constraints.get(cid)
            name = cdef.name if cdef else cid
            s, ev = 1, "Not directly addressed by this design."
            if cid == "minimize-downtime":
                cdc = [x for x in modern if x[1].role == "cdc"]
                stream = [x for x in modern if x[1].role == "streaming"]
                s = (2 if cdc else 0) + (1 if stream else 0) + (1 if not cdc and any(x[1].role == "orchestrator" for x in legacy) else 0)
                s = min(3, s)
                ev = (f"Continuous CDC via {names(cdc)} keeps the target in sync for a short cutover." if cdc
                      else "No CDC: history moves in bulk, so cutover needs a longer freeze window.")
            elif cid == "near-real-time":
                stream = [x for x in modern if x[1].role in {"streaming", "stream-processing"}]
                cdc = [x for x in modern if x[1].role == "cdc"]
                s = 3 if len(stream) >= 2 else 2 if stream or cdc else 0
                ev = f"Streaming path: {names(stream)}." if stream else ("CDC gives minutes-level freshness." if cdc else "Batch only.")
            elif cid == "minimize-rewrite":
                rw = rewrites()
                if not rw:
                    s, ev = 3, "Legacy processing is retained or rehosted; little code is rewritten up front."
                else:
                    pot = {"high": 3, "medium": 2, "low": 1}
                    avg = sum(pot.get(p, 2) for _, p in rw) / len(rw)
                    s = max(0, min(3, round(avg) - (1 if len(rw) > 2 else 0)))
                    ev = f"{len(rw)} rewrite area(s): " + ", ".join(f"{self.ontology.require(o).name} ({p} automation)" for o, p in rw[:3]) + "."
            elif cid == "reduce-licensing":
                commercial = [x for x in legacy if x[1].role in {"etl", "orchestrator", "bi", "legacy-warehouse"}]
                s = max(0, 3 - len(commercial))
                ev = (f"Retains licensed legacy tools: {names(commercial)}." if commercial
                      else "Legacy commercial ETL, scheduling and warehouse licences are retired.")
            elif cid == "maximize-managed":
                share = sum(1 for _, t in modern if t.operational_model in {"managed", "serverless", "saas"}) / max(1, len(modern))
                s = round(3 * share)
                ev = f"{round(share * 100)}% of target components are managed or serverless."
            elif cid == "retain-skills":
                sql = [x for x in modern if x[0].tech_id in SQL_FIRST]
                s = 3 if sql and legacy else 2 if sql else 1
                ev = f"SQL-first tooling ({names(sql)}) suits existing SQL skills." if sql else "Requires new programming skills."
            elif cid in {"avoid-lock-in", "open-architecture"}:
                open_ = [x for x in modern if x[1].vendor.lower() in OPEN_VENDORS or "open-source" in x[1].tags
                         or "open-format" in x[1].tags or x[0].tech_id.startswith("delta-") or x[0].tech_id == "apache-iceberg"]
                multi = [x for x in modern if len([c for c in x[1].clouds if c in {"aws", "azure", "gcp"}]) > 1 and x[1].role in {"lakehouse", "warehouse"}]
                s = min(3, (1 if multi else 0) + min(2, len(open_) // 2))
                ev = (f"Open components: {names(open_)}" if open_ else "Mostly proprietary managed services") + \
                     (f"; platform runs on several clouds ({names(multi)})." if multi else ".")
            elif cid in {"strict-governance", "regulatory"}:
                s = level_score.get(health.get("governance", "weak"), 1)
                if cid == "regulatory":
                    s = min(s, level_score.get(health.get("security", "weak"), 1))
                ev = f"Governance coverage {health.get('governance')}, security coverage {health.get('security')}."
            elif cid in {"high-availability", "disaster-recovery"}:
                s = level_score.get(health.get("resilience", "weak"), 1)
                ev = f"Resilience coverage {health.get('resilience')}."
            elif cid == "multi-cloud":
                plat = [x for x in modern if x[1].role in {"lakehouse", "warehouse"}]
                s = 3 if plat and all(len(x[1].clouds) > 1 for x in plat) else 1
                ev = "Data platform is available on multiple clouds." if s == 3 else "Data platform is tied to one cloud."
            elif cid == "hybrid-cloud":
                s = 3 if "network" in roles else 1
                ev = "Hybrid connectivity is designed in." if s == 3 else "No hybrid network path modelled."
            elif cid == "data-residency":
                s, ev = 2, "Region pinning is a deployment setting for every component here; verify each service's regions."
            crit.append(CriterionScore(id=cid, name=name, priority=priority, score=s, evidence=ev, baseline=baseline))

        weights = sum(PRIORITY_WEIGHT[c.priority] for c in crit) or 1
        fit = round(100 * sum(c.score * PRIORITY_WEIGHT[c.priority] for c in crit) / (3 * weights))
        strengths = [f"{c.name}: {c.evidence}" for c in sorted(crit, key=lambda c: (c.baseline, -c.score * PRIORITY_WEIGHT[c.priority])) if c.score >= 3][:3]
        trade = [f"{c.name}: {c.evidence}" for c in sorted(crit, key=lambda c: c.score) if c.score <= 1][:3]
        high = sum(1 for f in report.findings if f.severity in {"critical", "high"})
        return OptionFit(option_id=arch.id, label=arch.meta.label or "", name=arch.name, variant=arch.meta.variant or "",
                         summary=arch.meta.summary or "", fit_percent=fit, criteria=crit, strengths=strengths,
                         trade_offs=trade, component_count=len(arch.nodes), high_findings=high)

    def analyse(self, options: list[Architecture], estate: Estate) -> OptionAnalysis:
        fits = [self.score(a, estate) for a in options]
        _, assumed = self._criteria(estate)
        analysis = OptionAnalysis(fits=fits, priorities_assumed=assumed)
        if not fits:
            return analysis
        # Ties go to the target the user asked for, then to fewer high findings and fewer moving parts.
        best = max(fits, key=lambda f: (f.fit_percent, f.variant == "requested", -f.high_findings, -f.component_count))
        analysis.recommended_option_id = best.option_id
        analysis.headline = f"Option {best.label} best matches your stated priorities ({best.fit_percent}% fit)."
        analysis.rationale = " ".join(best.strengths[:2]) or best.summary
        for f in fits:
            analysis.choose_when[f.option_id] = f.summary + (f" Strongest on {f.strengths[0].split(':')[0].lower()}." if f.strengths else "")
        if assumed:
            analysis.caveats.append("No priorities were stated, so downtime, managed services and rewrite effort were weighted equally.")
        analysis.caveats.append("Fit scores reflect your stated priorities only — cost, team skills and existing contracts may change the answer.")
        return analysis
