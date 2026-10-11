"""Deterministic architecture validator and health dimensions.

Every check is a plain function over the graph and the ontology. Findings carry the evidence
that produced them and, where a fix is mechanical, a ready-made proposal the user can apply.
The LLM is never consulted here.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

import networkx as nx

from atlas.models.architecture import (
    SEVERITY_ORDER,
    Architecture,
    ArchitectureNode,
    HealthDimension,
    HealthEvidence,
    Operation,
    OperationConnect,
    Proposal,
    ValidationFinding,
    ValidationReport,
)
from atlas.models.ontology import DATA_LAYERS
from atlas.models.project import Estate
from atlas.ontology.service import OntologyService
from atlas.rules.connections import ConnectionEngine

CROSS_CUTTING_ROLES = {"governance", "security", "observability", "devops", "network", "cloud-platform", "data-quality", "resilience"}
SOURCE_ROLES = {"source-database", "legacy-warehouse", "mainframe", "file-source"}
PLATFORM_ROLES = {"lakehouse", "warehouse"}

DIMENSIONS = {
    "completeness": "Completeness",
    "operability": "Operability",
    "security": "Security coverage",
    "governance": "Governance coverage",
    "migration": "Migration readiness",
    "observability": "Observability coverage",
    "resilience": "Resilience coverage",
}


@dataclass
class Context:
    arch: Architecture
    ontology: OntologyService
    engine: ConnectionEngine
    estate: Estate | None
    caps: dict[str, list[ArchitectureNode]] = field(default_factory=lambda: defaultdict(list))
    roles: dict[str, list[ArchitectureNode]] = field(default_factory=lambda: defaultdict(list))
    cloud: str | None = None
    platform: str | None = None

    def tech(self, node: ArchitectureNode):
        return self.ontology.get(node.tech_id)

    def has_cap(self, *caps: str) -> list[ArchitectureNode]:
        out: list[ArchitectureNode] = []
        for c in caps:
            out.extend(n for n in self.caps.get(c, []) if n not in out)
        return out

    def names(self, nodes: list[ArchitectureNode]) -> str:
        return ", ".join(sorted({n.label or self.tech(n).name for n in nodes if self.tech(n)}))

    def constraint(self, cid: str, at_least: str = "low") -> bool:
        return bool(self.estate and self.estate.has(cid, at_least))  # type: ignore[arg-type]

    def platform_anchor(self) -> ArchitectureNode | None:
        for role in ("lakehouse", "warehouse"):
            if self.roles.get(role):
                return self.roles[role][0]
        return None


class Validator:
    def __init__(self, ontology: OntologyService, engine: ConnectionEngine):
        self.ontology = ontology
        self.engine = engine
        platforms = ontology.data.platforms
        self.clouds = platforms.clouds
        self.data_platforms = platforms.data_platforms

    # ------------------------------------------------------------------ public
    def validate(self, arch: Architecture, estate: Estate | None = None) -> ValidationReport:
        ctx = self._context(arch, estate)
        edge_status = self.engine.annotate(ctx.arch)
        findings: list[ValidationFinding] = []
        evidence: dict[str, list[HealthEvidence]] = defaultdict(list)

        def record(dim: str, check: str, passed: bool, detail: str):
            evidence[dim].append(HealthEvidence(check=check, passed=passed, detail=detail))

        for check in (
            self._data_checks,
            self._governance_checks,
            self._security_checks,
            self._reliability_checks,
            self._observability_checks,
            self._migration_checks,
            self._architecture_checks,
        ):
            findings.extend(check(ctx, record))

        # Edge-level connection intelligence findings.
        for edge in ctx.arch.edges:
            a = edge_status[edge.id]
            if a.status in {"VALID", "UNKNOWN"}:
                continue
            src, dst = ctx.arch.node(edge.source), ctx.arch.node(edge.target)
            if not src or not dst:
                continue
            sev = {"INVALID": "high", "UNUSUAL": "medium", "VALID_WITH_WARNING": "low"}[a.status]
            s_name = src.label or ctx.tech(src).name if ctx.tech(src) else src.tech_id
            d_name = dst.label or ctx.tech(dst).name if ctx.tech(dst) else dst.tech_id
            findings.append(ValidationFinding(
                id=f"CONN-{edge.id}", rule_id="ARCH-CONN", category="architecture", severity=sev,  # type: ignore[arg-type]
                title={"INVALID": "Incompatible connection", "UNUSUAL": "Suspicious direct connection",
                       "VALID_WITH_WARNING": "Connection works with caveats"}[a.status] + f": {s_name} → {d_name}",
                detail=a.reason, recommendation=a.suggestion or "", edge_ids=[edge.id], node_ids=[src.id, dst.id],
                evidence=[f"Rule {a.matched_rule}"] if a.matched_rule else [],
            ))
        valid_edges = sum(1 for a in edge_status.values() if a.status in {"VALID", "VALID_WITH_WARNING"})
        if ctx.arch.edges:
            record("completeness", "Connections are domain-valid", valid_edges == len(ctx.arch.edges),
                   f"{valid_edges} of {len(ctx.arch.edges)} connections are valid or valid with caveats.")

        findings.sort(key=lambda f: (SEVERITY_ORDER[f.severity], f.category, f.id))
        counts: dict[str, int] = defaultdict(int)
        for f in findings:
            counts[f.severity] += 1
        return ValidationReport(
            findings=findings,
            health=self._health(evidence),
            edge_status=edge_status,
            counts=dict(counts),
        )

    # ------------------------------------------------------------------ context
    def _context(self, arch: Architecture, estate: Estate | None) -> Context:
        ctx = Context(arch=arch.model_copy(deep=True), ontology=self.ontology, engine=self.engine, estate=estate)
        for n in ctx.arch.nodes:
            tech = self.ontology.get(n.tech_id)
            if not tech:
                continue
            ctx.roles[tech.role].append(n)
            for c in tech.capabilities:
                ctx.caps[c].append(n)
        ctx.cloud = arch.meta.target_cloud or (estate.target_cloud if estate else None)
        if not ctx.cloud:
            for n in ctx.roles.get("cloud-platform", []):
                ctx.cloud = n.tech_id if n.tech_id in self.clouds else None
        ctx.platform = arch.meta.data_platform or next(
            (n.tech_id for r in PLATFORM_ROLES for n in ctx.roles.get(r, []) if n.tech_id in self.data_platforms), None
        )
        return ctx

    def _block(self, ctx: Context, key: str) -> str | None:
        """Preferred technology for a building-block slot given the architecture's platform/cloud."""
        if ctx.platform and ctx.platform in self.data_platforms:
            v = self.data_platforms[ctx.platform].get(key)
            if v and self.ontology.exists(v):
                return v
        if ctx.cloud and ctx.cloud in self.clouds:
            v = self.clouds[ctx.cloud].get(key)
            if v and self.ontology.exists(v):
                return v
        return None

    def _add_proposal(self, ctx: Context, finding_id: str, tech_id: str | None, title: str, reason: str,
                      connect_to: list[ArchitectureNode] | None = None, connect_from: list[ArchitectureNode] | None = None,
                      kind: str | None = None) -> Proposal | None:
        if not tech_id or not self.ontology.exists(tech_id):
            return None
        tech = self.ontology.require(tech_id)
        connects = [OperationConnect(node=n.id, direction="to", kind=kind) for n in (connect_to or [])]
        connects += [OperationConnect(node=n.id, direction="from", kind=kind) for n in (connect_from or [])]
        return Proposal(
            title=title or f"Add {tech.name}",
            reason=reason,
            source="rules",
            finding_id=finding_id,
            confidence="high",
            operations=[Operation(op="add_node", tech_id=tech_id, node_id="new", connect=connects)],
            evidence=[f"{tech.name}: {tech.description}"],
        )

    # ------------------------------------------------------------------ data
    def _data_checks(self, ctx: Context, record):
        out: list[ValidationFinding] = []
        g = nx.DiGraph()
        for n in ctx.arch.nodes:
            g.add_node(n.id)
        data_edges = [e for e in ctx.arch.edges if e.kind == "data"]
        for e in ctx.arch.edges:
            g.add_edge(e.source, e.target)

        sources = [n for r in SOURCE_ROLES for n in ctx.roles.get(r, [])]
        # Mainframe runtime pieces (COBOL, CICS, JCL) are code, not data stores.
        sources = [n for n in sources if ctx.tech(n).role != "mainframe" or n.tech_id in {"vsam", "ims", "ibm-zos"}]
        # Modern target databases (e.g. a new managed OLTP store) are destinations, not sources to ingest.
        sources = [n for n in sources if ctx.tech(n).legacy or ctx.tech(n).environment == "on-prem"]
        no_path = [n for n in sources if not any(e.source == n.id for e in data_edges)]
        record("completeness", "Every source has an ingestion path", not no_path,
               "All sources feed the target." if not no_path else f"No outbound data flow from {ctx.names(no_path)}.")
        for n in no_path:
            tech = ctx.tech(n)
            cdc = next((s for s in tech.suggested_next if (t := self.ontology.get(s)) and t.role in {"cdc", "etl"}
                        and not t.legacy and (not t.platforms or ctx.platform in t.platforms) and t.runs_on(ctx.cloud)), None)
            out.append(ValidationFinding(
                id=f"DATA-001-{n.id}", rule_id="DATA-001", category="data", severity="high",
                title=f"Missing ingestion path from {n.label or tech.name}",
                detail=f"{tech.name} has no outbound data connection, so its data never reaches the target platform.",
                recommendation="Add a CDC or batch ingestion component from this source.",
                node_ids=[n.id], evidence=[f"{tech.name} role: {tech.role}"],
                proposal=self._add_proposal(ctx, f"DATA-001-{n.id}", cdc, f"Add {self.ontology.get(cdc).name if cdc else ''} ingestion",
                                            f"{tech.name} needs a governed path into the platform.", connect_from=[n]),
            ))

        consumers = [n for r in ("bi", "api", "ml") for n in ctx.roles.get(r, [])]
        has_platform = any(ctx.roles.get(r) for r in ("lakehouse", "warehouse", "lake-layer"))
        serving = ctx.roles.get("serving", []) + ctx.roles.get("warehouse", []) + [
            n for n in ctx.roles.get("lakehouse", [])
            if n.tech_id in self.data_platforms and self.data_platforms[n.tech_id].get("serving") == n.tech_id]
        if has_platform:
            ok = bool(serving)
            record("completeness", "Serving layer present", ok,
                   f"Serving via {ctx.names(serving)}." if ok else "No SQL serving endpoint or warehouse for consumers.")
            if not ok:
                gold = [n for n in ctx.roles.get("lake-layer", []) if ctx.tech(n).stage in {"gold", "curated"}]
                out.append(ValidationFinding(
                    id="DATA-002", rule_id="DATA-002", category="data", severity="medium",
                    title="Missing serving layer",
                    detail="Data lands in the platform but nothing exposes it to SQL consumers with concurrency and access control.",
                    recommendation="Add a serving endpoint between the curated layer and consumers.",
                    node_ids=[n.id for n in gold],
                    proposal=self._add_proposal(ctx, "DATA-002", self._block(ctx, "serving"), "Add serving layer",
                                                "Consumers need a governed SQL endpoint.", connect_from=gold[:1], connect_to=consumers[:2]),
                ))
            ok = bool(consumers)
            record("completeness", "Consumption layer present", ok,
                   f"Consumers: {ctx.names(consumers)}." if ok else "No BI, API or ML consumers are modelled.")
            if not ok:
                out.append(ValidationFinding(
                    id="DATA-003", rule_id="DATA-003", category="data", severity="low",
                    title="No consumers modelled",
                    detail="The architecture has no BI, API or ML consumers, so it is unclear who uses the migrated data.",
                    recommendation="Add the reporting or application consumers that depend on this data.",
                ))

        degree = defaultdict(int)
        for e in ctx.arch.edges:
            degree[e.source] += 1
            degree[e.target] += 1
        orphans = [n for n in ctx.arch.nodes if degree[n.id] == 0 and ctx.tech(n) and ctx.tech(n).role != "cloud-platform"]
        record("completeness", "No orphan components", not orphans,
               "Every component is connected." if not orphans else f"Unconnected: {ctx.names(orphans)}.")
        for n in orphans:
            tech = ctx.tech(n)
            cross = tech.role in CROSS_CUTTING_ROLES
            out.append(ValidationFinding(
                id=f"DATA-004-{n.id}", rule_id="DATA-004", category="data", severity="low" if cross else "medium",
                title=f"Orphan component: {n.label or tech.name}",
                detail=f"{tech.name} has no connections; its role in the design is undefined.",
                recommendation="Connect it to the components it serves, or remove it.", node_ids=[n.id],
            ))

        data_nodes = [n.id for n in ctx.arch.nodes if ctx.tech(n) and ctx.tech(n).role not in CROSS_CUTTING_ROLES and degree[n.id]]
        sub = g.subgraph(data_nodes).to_undirected()
        islands = [c for c in nx.connected_components(sub)] if data_nodes else []
        if len(islands) > 1:
            islands.sort(key=len, reverse=True)
            stray = [ctx.arch.node(i) for c in islands[1:] for i in c]
            out.append(ValidationFinding(
                id="DATA-005", rule_id="DATA-005", category="data", severity="medium",
                title=f"{len(islands)} disconnected data flows",
                detail=f"{ctx.names([s for s in stray if s])} form a flow that never joins the main architecture.",
                recommendation="Connect the separate flow, or split it into its own architecture option.",
                node_ids=[s.id for s in stray if s],
            ))
        record("completeness", "Single connected data flow", len(islands) <= 1,
               "One connected flow." if len(islands) <= 1 else f"{len(islands)} separate flows.")
        return out

    # ------------------------------------------------------------------ governance
    def _governance_checks(self, ctx: Context, record):
        out = []
        anchor = ctx.platform_anchor()
        if not anchor and not ctx.roles.get("lake-layer"):
            return out
        strict = ctx.constraint("strict-governance", "high") or ctx.constraint("regulatory", "high")
        targets = [n for n in [anchor, *ctx.roles.get("serving", [])] if n]

        catalog = ctx.has_cap("catalog")
        record("governance", "Catalog present", bool(catalog), f"Catalog: {ctx.names(catalog)}." if catalog else "No data catalog.")
        if not catalog:
            gov = self._block(ctx, "governance")
            name = self.ontology.get(gov).name if gov else "a catalog"
            platform_name = ctx.tech(anchor).name if anchor else "the platform"
            out.append(ValidationFinding(
                id="GOV-001", rule_id="GOV-001", category="governance", severity="critical" if strict else "high",
                title="No data catalog",
                detail=f"Your design has {platform_name} workloads but no explicit governance component, so tables, ownership and access policies are unmanaged.",
                recommendation=f"Add {name} to catalog and govern the platform.",
                evidence=[f"No component provides the 'catalog' capability among {len(ctx.arch.nodes)} components."],
                proposal=self._add_proposal(ctx, "GOV-001", gov, f"Add {name}",
                                            f"Your design currently has {platform_name} workloads but no explicit governance component.",
                                            connect_to=targets, kind="governance"),
            ))
        lineage = ctx.has_cap("lineage")
        record("governance", "Lineage captured", bool(lineage), f"Lineage: {ctx.names(lineage)}." if lineage else "No lineage capability.")
        if not lineage and catalog:
            out.append(ValidationFinding(
                id="GOV-002", rule_id="GOV-002", category="governance", severity="high" if strict else "medium",
                title="No lineage capture",
                detail="Without lineage, impact analysis and reconciliation of migrated reports are manual.",
                recommendation="Use a catalog that captures lineage or add a lineage tool.",
            ))
        access = ctx.has_cap("access-control", "iam", "identity")
        record("governance", "Access control defined", bool(access),
               f"Access control: {ctx.names(access)}." if access else "No access-control component.")
        if not access:
            iam = self._block(ctx, "identity")
            out.append(ValidationFinding(
                id="GOV-003", rule_id="GOV-003", category="governance", severity="high",
                title="No access control", detail="No component defines who can read or change data.",
                recommendation="Add identity and fine-grained access control.",
                proposal=self._add_proposal(ctx, "GOV-003", iam, "Add identity & access management", "Data access must be governed.",
                                            connect_to=targets[:1], kind="security"),
            ))
        return out

    # ------------------------------------------------------------------ security
    def _security_checks(self, ctx: Context, record):
        out = []
        cloud_nodes = [n for n in ctx.arch.nodes if ctx.tech(n) and not ctx.tech(n).legacy]
        if not cloud_nodes:
            return out
        credential_users = [n for r in ("cdc", "etl", "orchestrator") for n in ctx.roles.get(r, [])]
        secrets = ctx.has_cap("secrets-management")
        record("security", "Secrets managed", bool(secrets) or not credential_users,
               f"Secrets: {ctx.names(secrets)}." if secrets else "Connectors/jobs need credentials but no secrets manager is modelled.")
        if credential_users and not secrets:
            sid = self._block(ctx, "secrets")
            out.append(ValidationFinding(
                id="SEC-001", rule_id="SEC-001", category="security", severity="high",
                title="No secrets management",
                detail=f"{ctx.names(credential_users)} connect to source systems with credentials, but nothing manages or rotates them.",
                recommendation="Store connection credentials in a managed secrets service.",
                node_ids=[n.id for n in credential_users],
                proposal=self._add_proposal(ctx, "SEC-001", sid, "Add secrets management", "Connectors need managed credentials.",
                                            connect_to=credential_users[:3], kind="security"),
            ))
        iam = ctx.has_cap("iam", "identity")
        record("security", "Identity & IAM", bool(iam), f"IAM: {ctx.names(iam)}." if iam else "No identity provider or IAM modelled.")
        if not iam:
            out.append(ValidationFinding(
                id="SEC-002", rule_id="SEC-002", category="security", severity="medium",
                title="IAM not modelled", detail="Service identities and least-privilege roles are not represented.",
                recommendation="Add the cloud's IAM / identity provider.",
                proposal=self._add_proposal(ctx, "SEC-002", self._block(ctx, "identity"), "Add IAM", "Least-privilege service identities.",
                                            connect_to=[n for n in [ctx.platform_anchor()] if n], kind="security"),
            ))
        enc = ctx.has_cap("encryption", "key-management")
        regulated = ctx.constraint("regulatory", "medium")
        record("security", "Encryption keys", bool(enc), f"Encryption: {ctx.names(enc)}." if enc else "Default provider-managed encryption only.")
        if not enc:
            out.append(ValidationFinding(
                id="SEC-003", rule_id="SEC-003", category="security", severity="medium" if regulated else "low",
                title="Encryption key management not explicit",
                detail="Data is encrypted at rest by default on managed services, but customer-managed keys are not modelled"
                       + (" — usually required under regulatory constraints." if regulated else "."),
                recommendation="Decide on customer-managed keys for sensitive data.",
                proposal=self._add_proposal(ctx, "SEC-003", self._block(ctx, "key_management"), "Add key management",
                                            "Customer-managed encryption keys.", connect_to=[n for n in [ctx.platform_anchor()] if n], kind="security"),
            ))
        on_prem = [n for n in ctx.arch.nodes if ctx.tech(n) and ctx.tech(n).environment == "on-prem"
                   and ctx.tech(n).role in SOURCE_ROLES and any(e.source == n.id for e in ctx.arch.edges)]
        boundary = ctx.has_cap("hybrid-connectivity", "network-boundary", "private-connectivity")
        if on_prem:
            record("security", "Network boundary for hybrid traffic", bool(boundary),
                   f"Network: {ctx.names(boundary)}." if boundary else f"{ctx.names(on_prem)} send data to the cloud without a modelled private network path.")
            if not boundary:
                ingest = [n for r in ("cdc", "etl") for n in ctx.roles.get(r, []) if not ctx.tech(n).legacy]
                out.append(ValidationFinding(
                    id="SEC-004", rule_id="SEC-004", category="security", severity="medium",
                    title="No network boundary for on-prem → cloud traffic",
                    detail=f"Data from {ctx.names(on_prem)} crosses into the cloud with no private connectivity or perimeter modelled.",
                    recommendation="Add dedicated interconnect/VPN and a service perimeter.",
                    node_ids=[n.id for n in on_prem],
                    proposal=self._add_proposal(ctx, "SEC-004", self._block(ctx, "hybrid_network"), "Add private connectivity",
                                                "Source data should not traverse the public internet.", connect_to=ingest[:2], kind="security"),
                ))
        return out

    # ------------------------------------------------------------------ reliability
    def _reliability_checks(self, ctx: Context, record):
        out = []
        anchor = ctx.platform_anchor()
        if not anchor:
            return out
        dr_needed = ctx.constraint("disaster-recovery", "medium")
        ha_needed = ctx.constraint("high-availability", "medium")
        backup = ctx.has_cap("backup", "point-in-time-recovery", "time-travel")
        record("resilience", "Backup / point-in-time recovery", bool(backup),
               f"Backup: {ctx.names(backup)}." if backup else "No backup or time-travel capability modelled.")
        if not backup:
            out.append(ValidationFinding(
                id="REL-001", rule_id="REL-001", category="reliability", severity="medium" if dr_needed else "low",
                title="No backup strategy", detail="Recovery from bad loads or accidental deletes is not designed.",
                recommendation="Model backups, object versioning or table time-travel retention.",
                proposal=self._add_proposal(ctx, "REL-001", "backup-recovery", "Add backup & recovery", "Recover from bad loads and deletes.",
                                            connect_to=[anchor]),
            ))
        dr = ctx.has_cap("disaster-recovery")
        record("resilience", "Disaster recovery", bool(dr), f"DR: {ctx.names(dr)}." if dr else "No DR region or failover modelled.")
        if not dr:
            out.append(ValidationFinding(
                id="REL-002", rule_id="REL-002", category="reliability", severity="high" if dr_needed else "low",
                title="No disaster recovery", detail="A regional outage would stop the platform; RPO/RTO are undefined"
                + (" despite a stated DR requirement." if dr_needed else "."),
                recommendation="Add cross-region replication and a tested failover runbook.",
                proposal=self._add_proposal(ctx, "REL-002", "cross-region-dr", "Add disaster recovery", "Survive a regional outage.",
                                            connect_to=[anchor]),
            ))
        managed = [n for n in ctx.arch.nodes if ctx.tech(n) and ctx.tech(n).operational_model in {"managed", "serverless", "saas"}]
        self_managed = [n for n in ctx.arch.nodes if ctx.tech(n) and not ctx.tech(n).legacy
                        and ctx.tech(n).operational_model == "self-managed" and ctx.tech(n).role not in CROSS_CUTTING_ROLES]
        ha_ok = bool(ctx.has_cap("high-availability")) or not self_managed
        record("resilience", "High availability", ha_ok,
               f"{len(managed)} managed services carry provider SLAs." + (f" Self-managed: {ctx.names(self_managed)}." if self_managed else ""))
        if ha_needed and self_managed:
            out.append(ValidationFinding(
                id="REL-003", rule_id="REL-003", category="reliability", severity="medium",
                title="HA not designed for self-managed components",
                detail=f"{ctx.names(self_managed)} are self-managed; their HA topology is not modelled.",
                recommendation="Deploy multi-zone or replace with managed equivalents.",
                node_ids=[n.id for n in self_managed],
            ))
        pipelines = [n for r in ("cdc", "streaming", "stream-processing", "transformation") for n in ctx.roles.get(r, [])]
        retry = ctx.has_cap("retry-strategy", "dead-letter-queue")
        if pipelines:
            record("resilience", "Retry / dead-letter strategy", bool(retry),
                   f"Retry: {ctx.names(retry)}." if retry else "Pipelines have no explicit retry or dead-letter handling.")
            if not retry:
                out.append(ValidationFinding(
                    id="REL-004", rule_id="REL-004", category="reliability", severity="low",
                    title="No retry / dead-letter strategy",
                    detail="Failed records or tasks have no isolation path; failures either block pipelines or are lost.",
                    recommendation="Add idempotent retries with a dead-letter destination.",
                    proposal=self._add_proposal(ctx, "REL-004", "retry-dead-letter", "Add retry & dead-letter handling",
                                                "Isolate and replay failures.", connect_from=pipelines[:1]),
                ))
        return out

    # ------------------------------------------------------------------ observability
    def _observability_checks(self, ctx: Context, record):
        out = []
        runtime = [n for n in ctx.arch.nodes if ctx.tech(n) and not ctx.tech(n).legacy and ctx.tech(n).role not in CROSS_CUTTING_ROLES]
        if not runtime:
            return out
        targets = [n for n in [ctx.platform_anchor(), *ctx.roles.get("cdc", [])[:1]] if n]
        mon = ctx.has_cap("monitoring")
        record("observability", "Monitoring", bool(mon), f"Monitoring: {ctx.names(mon)}." if mon else "No monitoring.")
        record("operability", "Monitoring", bool(mon), "Platform health is observable." if mon else "Operators cannot see platform health.")
        if not mon:
            out.append(ValidationFinding(
                id="OBS-001", rule_id="OBS-001", category="observability", severity="high",
                title="No monitoring", detail="Pipeline latency, failures and capacity are invisible to operators.",
                recommendation="Add the cloud monitoring service and platform metrics.",
                proposal=self._add_proposal(ctx, "OBS-001", self._block(ctx, "monitoring"), "Add monitoring",
                                            "Operators need visibility of pipelines and platform.", connect_to=targets, kind="monitoring"),
            ))
        logs = ctx.has_cap("logging")
        record("observability", "Logging", bool(logs), f"Logging: {ctx.names(logs)}." if logs else "No centralised logging.")
        if not logs:
            out.append(ValidationFinding(
                id="OBS-002", rule_id="OBS-002", category="observability", severity="medium",
                title="No centralised logging", detail="Audit and troubleshooting rely on per-service logs.",
                recommendation="Route platform and pipeline logs to a central log service.",
                proposal=self._add_proposal(ctx, "OBS-002", self._block(ctx, "logging"), "Add logging", "Centralise logs.",
                                            connect_to=targets, kind="monitoring"),
            ))
        alerting = ctx.has_cap("alerting")
        record("observability", "Alerting", bool(alerting), f"Alerting: {ctx.names(alerting)}." if alerting else "No alerting.")
        if not alerting and not mon:
            out.append(ValidationFinding(
                id="OBS-003", rule_id="OBS-003", category="observability", severity="low",
                title="No alerting", detail="Failures are noticed by users before operators.",
                recommendation="Define alerts on SLAs such as CDC lag and job failures.",
            ))
        orchestrated = bool(ctx.roles.get("orchestrator"))
        record("operability", "Orchestration", orchestrated,
               f"Orchestrated by {ctx.names(ctx.roles.get('orchestrator', []))}." if orchestrated else "No orchestrator.")
        cicd = ctx.has_cap("ci-cd", "infrastructure-as-code", "deployment-automation")
        record("operability", "CI/CD & IaC", bool(cicd), f"Delivery: {ctx.names(cicd)}." if cicd else "Deployments are manual.")
        if not cicd:
            out.append(ValidationFinding(
                id="OPS-001", rule_id="OPS-001", category="observability", severity="low",
                title="No CI/CD or infrastructure-as-code",
                detail="Pipelines and infrastructure would be deployed by hand, which makes environments drift.",
                recommendation="Add CI/CD and infrastructure-as-code.",
                proposal=self._add_proposal(ctx, "OPS-001", self._block(ctx, "ci_cd"), "Add CI/CD", "Repeatable deployments.",
                                            connect_to=[n for n in [ctx.platform_anchor()] if n], kind="control"),
            ))
        return out

    # ------------------------------------------------------------------ migration
    def _migration_checks(self, ctx: Context, record):
        out = []
        legacy = [n for n in ctx.arch.nodes if ctx.tech(n) and ctx.tech(n).legacy]
        legacy_sources = [n for n in legacy if ctx.tech(n).role in SOURCE_ROLES]
        if not legacy_sources:
            record("migration", "Legacy estate in scope", False, "No legacy sources on the canvas — migration readiness not assessed.")
            return out
        controls = set(ctx.arch.meta.migration_controls)
        recon = ctx.has_cap("reconciliation")
        record("migration", "Source-to-target reconciliation", bool(recon),
               f"Reconciliation: {ctx.names(recon)}." if recon else "Nothing proves migrated data matches the source.")
        if not recon:
            dq = "reconciliation-framework"
            if ctx.platform == "bigquery" or ctx.cloud == "gcp" and ctx.platform != "databricks":
                dq = "google-dvt" if self.ontology.exists("google-dvt") else dq
            last = [n for n in ctx.roles.get("lake-layer", []) if ctx.tech(n).stage in {"gold", "curated"}] or \
                   [n for n in [ctx.platform_anchor()] if n]
            out.append(ValidationFinding(
                id="MIG-001", rule_id="MIG-001", category="migration", severity="high",
                title="No reconciliation",
                detail=f"Nothing compares {ctx.names(legacy_sources)} with the migrated data. Without row counts, checksums and "
                       "aggregate comparisons, the business cannot sign off cutover.",
                recommendation="Add a reconciliation component comparing source and target during parallel run.",
                node_ids=[n.id for n in legacy_sources],
                evidence=[f"Legacy sources: {ctx.names(legacy_sources)}", "No component provides the 'reconciliation' capability."],
                proposal=self._add_proposal(ctx, "MIG-001", dq, "Add reconciliation",
                                            f"Prove that data migrated from {ctx.names(legacy_sources)} matches the source before cutover.",
                                            connect_from=legacy_sources[:1] + last[:1]),
            ))
        parallel = bool(ctx.has_cap("parallel-run-support")) or "parallel-run" in controls
        record("migration", "Parallel-run approach", parallel, "Parallel run is planned." if parallel else "No parallel-run approach.")
        if not parallel:
            out.append(ValidationFinding(
                id="MIG-002", rule_id="MIG-002", category="migration", severity="medium",
                title="No parallel-run approach",
                detail="Legacy and target outputs are never compared side by side before switch-over.",
                recommendation="Plan a parallel run with reconciliation gates.",
                proposal=Proposal(title="Plan a parallel run", reason="Compare legacy and target outputs before switching consumers.",
                                  finding_id="MIG-002", operations=[Operation(op="set_control", value="parallel-run")]),
            ))
        for control, rid, title, detail in (
            ("rollback-plan", "MIG-003", "No rollback plan", "If the target misbehaves after cutover, there is no defined way back to the legacy path."),
            ("cutover-plan", "MIG-004", "No cutover plan", "The switch of producers and consumers is not sequenced or rehearsed."),
        ):
            ok = control in controls
            record("migration", title.replace("No ", "").capitalize(), ok, f"{control} defined." if ok else detail)
            if not ok:
                sev = "high" if ctx.constraint("minimize-downtime", "high") else "medium"
                out.append(ValidationFinding(
                    id=rid, rule_id=rid, category="migration", severity=sev, title=title, detail=detail,
                    recommendation="Generating the migration roadmap defines cutover and rollback gates.",
                    proposal=Proposal(title=title.replace("No ", "Define "), reason=detail, finding_id=rid,
                                      operations=[Operation(op="set_control", value=control)]),
                ))
        unassigned = [n for n in legacy if not (n.strategy or n.suggested_strategy)]
        record("migration", "Strategies assigned", not unassigned,
               "Every legacy component has a strategy." if not unassigned else f"No strategy for {ctx.names(unassigned)}.")
        return out

    # ------------------------------------------------------------------ architecture
    def _architecture_checks(self, ctx: Context, record):
        out = []
        anchor = ctx.platform_anchor()
        layers = ctx.roles.get("lake-layer", [])
        legacy_etl = [n for n in ctx.roles.get("etl", []) if ctx.tech(n).legacy]
        transforms = [n for r in ("transformation", "processing", "stream-processing") for n in ctx.roles.get(r, [])] + \
                     [n for n in ctx.roles.get("etl", []) if not ctx.tech(n).legacy]
        if anchor and len(layers) > 2 or legacy_etl:
            ok = bool(transforms)
            record("completeness", "Transformation layer", ok, f"Transformation: {ctx.names(transforms)}." if ok else "No transformation layer.")
            if not ok and anchor:
                tid = self._block(ctx, "transformation")
                out.append(ValidationFinding(
                    id="ARCH-001", rule_id="ARCH-001", category="architecture", severity="medium",
                    title="Missing transformation layer",
                    detail="Data moves between zones but no component owns the transformation logic"
                           + (f" that {ctx.names(legacy_etl)} implements today." if legacy_etl else "."),
                    recommendation="Add the platform's transformation framework.",
                    proposal=self._add_proposal(ctx, "ARCH-001", tid, "Add transformation layer", "Own the business logic in code.",
                                                connect_to=[l for l in layers if ctx.tech(l).stage in {"silver", "gold", "staging", "curated"}][:2]),
                ))
        if transforms or anchor:
            orch = ctx.roles.get("orchestrator", []) + [
                n for n in ctx.has_cap("workflow-orchestration", "orchestration") if not ctx.tech(n).legacy and n not in ctx.roles.get("orchestrator", [])]
            ok = bool(orch)
            if not ok:
                oid = self._block(ctx, "orchestration")
                out.append(ValidationFinding(
                    id="ARCH-002", rule_id="ARCH-002", category="architecture", severity="medium",
                    title="Missing orchestration", detail="Nothing schedules pipelines or manages their dependencies.",
                    recommendation="Add an orchestrator.",
                    proposal=self._add_proposal(ctx, "ARCH-002", oid, "Add orchestration", "Schedule and sequence pipelines.",
                                                connect_to=(transforms or [anchor])[:2], kind="control"),
                ))
            for n in orch:
                tech = ctx.tech(n)
                if tech.legacy and tech.role == "orchestrator":
                    target = next((t for t in tech.possible_targets if (x := self.ontology.get(t)) and
                                   (not x.platforms or ctx.platform in x.platforms) and x.runs_on(ctx.cloud)), None)
                    tname = self.ontology.get(target).name if target else "a cloud-native orchestrator"
                    out.append(ValidationFinding(
                        id=f"ARCH-003-{n.id}", rule_id="ARCH-003", category="architecture", severity="info",
                        title=f"{tech.name} retained in the target state",
                        detail=f"{tech.name} still schedules cloud workloads. That is a sound coexistence choice, but it keeps a licence "
                               f"and an agent footprint; {tname} could own scheduling after cutover.",
                        recommendation=f"Replace with {tname} once migrated workloads are stable.",
                        node_ids=[n.id],
                        proposal=Proposal(title=f"Replace {tech.name} with {tname}", source="rules",
                                          reason=f"Native scheduling removes the {tech.name} dependency after cutover.",
                                          finding_id=f"ARCH-003-{n.id}", confidence="medium",
                                          operations=[Operation(op="replace_node", node_id=n.id, tech_id=target)]) if target else None,
                    ))

        if ctx.cloud:
            mismatched = [n for n in ctx.arch.nodes if ctx.tech(n) and not ctx.tech(n).legacy and ctx.tech(n).clouds
                          and ctx.tech(n).role != "cloud-platform" and not ctx.tech(n).runs_on(ctx.cloud)
                          and "on-prem" not in ctx.tech(n).clouds]
            for n in mismatched:
                tech = ctx.tech(n)
                out.append(ValidationFinding(
                    id=f"ARCH-004-{n.id}", rule_id="ARCH-004", category="architecture", severity="medium",
                    title=f"{tech.name} does not run on {self.clouds[ctx.cloud].name if ctx.cloud in self.clouds else ctx.cloud}",
                    detail=f"{tech.name} is available on {', '.join(tech.clouds)}; this architecture targets {ctx.cloud}.",
                    recommendation="Replace it with the target cloud's equivalent or justify the cross-cloud dependency.",
                    node_ids=[n.id],
                ))
        for n in ctx.arch.nodes:
            tech = ctx.tech(n)
            if not tech:
                out.append(ValidationFinding(
                    id=f"ARCH-005-{n.id}", rule_id="ARCH-005", category="architecture", severity="low",
                    title=f"Unknown component '{n.tech_id}'", detail="This component is not in the ontology, so it cannot be validated.",
                    node_ids=[n.id],
                ))
                continue
            if tech.platforms and ctx.platform and ctx.platform not in tech.platforms:
                out.append(ValidationFinding(
                    id=f"ARCH-006-{n.id}", rule_id="ARCH-006", category="architecture", severity="medium",
                    title=f"{tech.name} needs {', '.join(tech.platforms)}",
                    detail=f"{tech.name} only works with {', '.join(tech.platforms)}, but the target platform is {ctx.platform}.",
                    node_ids=[n.id],
                ))
        return out

    # ------------------------------------------------------------------ health
    def _health(self, evidence: dict[str, list[HealthEvidence]]) -> list[HealthDimension]:
        dims = []
        for key, name in DIMENSIONS.items():
            items = evidence.get(key, [])
            applicable = len(items)
            passed = sum(1 for e in items if e.passed)
            if applicable == 0 or (key == "migration" and applicable == 1 and not passed):
                level = "not-assessed"
                summary = "Not enough components to assess."
            else:
                ratio = passed / applicable
                level = "strong" if ratio >= 0.8 else "partial" if ratio >= 0.5 else "weak"
                summary = f"{passed} of {applicable} checks satisfied."
            dims.append(HealthDimension(id=key, name=name, level=level, passed=passed, applicable=applicable,  # type: ignore[arg-type]
                                        summary=summary, evidence=items))
        return dims


def data_layer_index(layer: str | None) -> int:
    return DATA_LAYERS.index(layer) if layer in DATA_LAYERS else len(DATA_LAYERS)
