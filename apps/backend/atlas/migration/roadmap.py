"""Migration dependency graph and phased roadmap — deterministic, architecture-specific."""

from __future__ import annotations

import networkx as nx

from atlas.models.architecture import Architecture, ArchitectureNode
from atlas.models.project import (
    DependencyEdge,
    DependencyGraph,
    DependencyNode,
    Estate,
    MigrationWave,
    Roadmap,
    WaveItem,
)
from atlas.ontology.service import OntologyService

MAINFRAME_DATA = {"ibm-db2-zos", "vsam", "ims"}

# Order in which legacy roles typically have to move: data before the logic that reads it,
# logic before the reports that depend on it, schedulers last because they span everything.
ROLE_RANK = {"source-database": 0, "legacy-warehouse": 0, "mainframe": 0, "file-source": 0, "streaming": 1,
             "cdc": 1, "etl": 2, "application": 2, "processing": 2, "bi": 3, "orchestrator": 4}
ROLE_WAVE = {"source-database": 4, "legacy-warehouse": 4, "mainframe": 4, "file-source": 3, "streaming": 3, "cdc": 3,
             "etl": 5, "application": 5, "processing": 5, "bi": 6, "orchestrator": 5}

WAVES = [
    ("discovery", "Discovery", "Inventory the estate, confirm scope, and agree strategies for every system."),
    ("foundation", "Cloud foundation", "Stand up the landing zone, identity, governance and delivery tooling."),
    ("connectivity", "Connectivity", "Establish private, secure paths between the data centre and the cloud."),
    ("ingestion", "Ingestion", "Bring ongoing changes into the platform continuously."),
    ("historical", "Historical data migration", "Move and validate historical data in bulk."),
    ("transformation", "Transformation migration", "Re-implement transformation and scheduling logic on the target."),
    ("consumption", "BI / consumption", "Repoint or rebuild reports, dashboards and downstream consumers."),
    ("reconciliation", "Reconciliation", "Prove source and target agree before anyone relies on the target."),
    ("parallel-run", "Parallel run", "Run legacy and target side by side and compare outputs every cycle."),
    ("cutover", "Cutover", "Switch producers and consumers in dependency order with a rehearsed rollback."),
    ("hypercare", "Hypercare", "Stabilise operations with heightened monitoring and support."),
    ("decommission", "Decommissioning", "Retire legacy systems, licences and infrastructure."),
]


class RoadmapPlanner:
    def __init__(self, ontology: OntologyService):
        self.ontology = ontology

    def _name(self, n: ArchitectureNode) -> str:
        t = self.ontology.get(n.tech_id)
        return n.label or (t.name if t else n.tech_id)

    def _role(self, n: ArchitectureNode) -> str:
        t = self.ontology.get(n.tech_id)
        return t.role if t else "unknown"

    _estate: set[str] = set()

    def _legacy(self, n: ArchitectureNode) -> bool:
        t = self.ontology.get(n.tech_id)
        if not t:
            return False
        if n.replaces:
            return False  # a target component standing in for legacy ones
        # Anything the estate runs today is part of the migration, even if it is retained (e.g. Tableau).
        return t.legacy or n.tech_id in self._estate or (t.environment == "on-prem" and t.role in ROLE_RANK)

    def with_estate(self, arch: Architecture, estate: Estate | None) -> Architecture:
        """The target canvas usually omits legacy systems that were replaced (e.g. Informatica once its
        pipelines move to the platform). They still have to be migrated and decommissioned, so add the
        declared estate back as off-canvas legacy nodes for planning."""
        if not estate:
            return arch
        present = {n.tech_id for n in arch.nodes}
        extra = []
        for tid in estate.current_technologies:
            tech = self.ontology.get(tid)
            if not tech or tid in present:
                continue
            replaced_by = next((n for n in arch.nodes if tid in n.replaces), None)
            strategy = {"etl": "refactor", "orchestrator": "replatform", "bi": "repurchase", "mainframe": "refactor"}.get(tech.role, "retire")
            extra.append(ArchitectureNode(id=f"estate-{tid}", tech_id=tid, origin="rules",
                                          suggested_strategy=strategy if replaced_by else None,
                                          environment="On-Prem", layer=tech.layer))
        if not extra:
            return arch
        out = arch.model_copy(deep=True)
        out.nodes.extend(extra)
        return out

    # ------------------------------------------------------------------ dependencies
    def dependencies(self, arch: Architecture, estate: Estate | None = None) -> DependencyGraph:
        self._estate = set(estate.current_technologies) if estate else set()
        arch = self.with_estate(arch, estate)
        legacy = [n for n in arch.nodes if self._legacy(n)]
        targets = [n for n in arch.nodes if not self._legacy(n)]
        graph = DependencyGraph()
        g = nx.DiGraph()
        for n in legacy:
            graph.nodes.append(DependencyNode(id=n.id, label=self._name(n), tech_id=n.tech_id, kind="legacy"))
            g.add_node(n.id)
        data_roles = {"source-database", "legacy-warehouse", "file-source"}
        is_data = lambda n: self._role(n) in data_roles or n.tech_id in MAINFRAME_DATA  # noqa: E731
        is_sched = lambda n: self._role(n) == "orchestrator" or n.tech_id == "jcl"  # noqa: E731

        def add(a: str, b: str, rel: str) -> None:
            if a != b and not g.has_edge(a, b) and not g.has_edge(b, a):
                graph.edges.append(DependencyEdge(source=a, target=b, relation=rel))  # type: ignore[arg-type]
                g.add_edge(a, b)

        # Explicit edges between legacy components on the canvas. Programs that read/write a data
        # store depend on it, so the data store comes first.
        for e in arch.edges:
            if e.source in g and e.target in g:
                s_node, t_node = arch.node(e.source), arch.node(e.target)
                if is_sched(s_node):
                    add(e.source, e.target, "orchestrates")
                elif is_data(t_node) and not is_data(s_node):
                    add(e.target, e.source, "feeds")
                else:
                    add(e.source, e.target, "feeds")
        # Implied estate flow (the target canvas usually omits legacy-to-legacy wiring):
        # data stores → ETL → BI, and schedulers orchestrate the jobs.
        etls = [n for n in legacy if self._role(n) == "etl"]
        bis = [n for n in legacy if self._role(n) == "bi"]
        for a in legacy:
            for b in legacy:
                if is_sched(a) and not is_sched(b) and self._role(b) in {"etl", "legacy-warehouse", "mainframe", "processing"}:
                    add(a.id, b.id, "orchestrates")
                elif is_data(a) and self._role(b) == "etl":
                    add(a.id, b.id, "feeds")
                elif self._role(a) == "etl" and self._role(b) == "bi":
                    add(a.id, b.id, "feeds")
                elif is_data(a) and self._role(b) == "bi" and not etls:
                    add(a.id, b.id, "feeds")
                elif self._role(a) == "streaming" and self._role(b) == "etl":
                    add(a.id, b.id, "feeds")
        del bis
        # Legacy → target "migrates to".
        for t in targets:
            graph.nodes.append(DependencyNode(id=t.id, label=self._name(t), tech_id=t.tech_id, kind="target"))
            for src in legacy:
                if src.tech_id in t.replaces:
                    graph.edges.append(DependencyEdge(source=src.id, target=t.id, relation="migrates_to"))
        landing_roles = {"lakehouse", "warehouse", "lake-layer", "serving", "source-database"}
        for src in legacy:
            if any(e.source == src.id and e.relation == "migrates_to" for e in graph.edges):
                continue
            if self._role(src) in {"orchestrator", "bi"}:
                continue  # retained or repointed, not moved into a data store
            # Data follows the data edges until it lands in a store on the target platform.
            seen, frontier, first = {src.id}, [src.id], None
            while frontier and not first:
                nxt = []
                for nid in frontier:
                    for e in arch.edges:
                        if e.source != nid or e.kind != "data" or e.target in seen:
                            continue
                        node = arch.node(e.target)
                        if not node or self._legacy(node):
                            continue
                        t = self.ontology.get(node.tech_id)
                        if t and t.role in landing_roles and t.stage != "landing":
                            first = node.id
                            break
                        seen.add(e.target)
                        nxt.append(e.target)
                    if first:
                        break
                frontier = nxt
            if first:
                graph.edges.append(DependencyEdge(source=src.id, target=first, relation="migrates_to"))
        # Orchestrators span everything they schedule, so they always go last regardless of edge direction.
        sched = [n.id for n in legacy if is_sched(n)]
        order_graph = g.copy()
        order_graph.remove_edges_from([(a, b) for a, b in list(order_graph.edges) if a in sched])
        try:
            order = list(nx.lexicographical_topological_sort(
                order_graph, key=lambda nid: (9 if nid in sched else ROLE_RANK.get(self._role(arch.node(nid)), 9), self._name(arch.node(nid)))))
        except nx.NetworkXUnfeasible:
            order = sorted(g.nodes, key=lambda nid: ROLE_RANK.get(self._role(arch.node(nid)), 9))
        graph.order = order
        for dn in graph.nodes:
            node = arch.node(dn.id)
            if dn.kind == "legacy" and node:
                dn.wave = ROLE_WAVE.get(self._role(node), 5)
        return graph

    # ------------------------------------------------------------------ roadmap
    def generate(self, arch: Architecture, estate: Estate | None = None) -> Roadmap:
        deps = self.dependencies(arch, estate)
        arch_id = arch.id
        arch = self.with_estate(arch, estate)
        by_role: dict[str, list[ArchitectureNode]] = {}
        for n in arch.nodes:
            by_role.setdefault(self._role(n), []).append(n)
        legacy = [arch.node(i) for i in deps.order if arch.node(i)]
        modern = [n for n in arch.nodes if not self._legacy(n)]

        def names(nodes) -> str:
            return ", ".join(dict.fromkeys(self._name(n) for n in nodes)) or "—"

        def item(title, detail="", nodes=()):
            return WaveItem(title=title, detail=detail, node_ids=[n.id for n in nodes])

        def skills(nodes) -> list[str]:
            out: list[str] = []
            for n in nodes:
                t = self.ontology.get(n.tech_id)
                for s in (t.skills if t else []):
                    if s not in out:
                        out.append(s)
            return out[:8]

        def roles(*rs):
            return [n for r in rs for n in by_role.get(r, [])]

        waves: list[MigrationWave] = []
        for idx, (wid, name, goal) in enumerate(WAVES):
            waves.append(MigrationWave(id=f"wave-{idx}", index=idx, name=name, goal=goal,
                                       depends_on=[f"wave-{idx - 1}"] if idx else []))
        W = {w.id: w for w in waves}

        # Wave 0 — discovery
        for n in legacy:
            t = self.ontology.get(n.tech_id)
            strat = n.strategy or n.suggested_strategy or "assess"
            first = t.migration_considerations[0] if t and t.migration_considerations else ""
            W["wave-0"].activities.append(item(f"Inventory {self._name(n)} — strategy: {strat}", first, [n]))
        W["wave-0"].activities.append(item("Agree success criteria, reconciliation tolerances and cutover windows with business owners"))
        W["wave-0"].exit_criteria = ["Every legacy system has an owner and an agreed strategy", "Dependency map signed off"]
        W["wave-0"].skills = ["Migration assessment", "Business analysis"]

        # Wave 1 — foundation
        found = roles("security", "governance", "devops", "lakehouse", "warehouse", "object-storage", "lake-layer", "container")
        found = [n for n in found if not self._legacy(n)]
        for n in found:
            W["wave-1"].activities.append(item(f"Provision {self._name(n)}", "", [n]))
        W["wave-1"].exit_criteria = ["Environments (dev/test/prod) created through infrastructure-as-code", "Access model approved by security"]
        W["wave-1"].skills = skills(found)

        # Wave 2 — connectivity
        net = roles("network")
        cdc = [n for n in roles("cdc") if not self._legacy(n)]
        for n in net:
            W["wave-2"].activities.append(item(f"Establish {self._name(n)}", "Bandwidth sized for historical transfer and CDC peaks.", [n]))
        for n in cdc:
            W["wave-2"].activities.append(item(f"Open source-system access for {self._name(n)}", "Service accounts, firewall rules, log access.", [n]))
        if not net and not cdc:
            W["wave-2"].activities.append(item("Confirm network paths from data sources to the cloud"))
        W["wave-2"].exit_criteria = ["Test connection from every source to the landing zone succeeds"]
        W["wave-2"].skills = skills(net + cdc) or ["Cloud networking"]

        # Wave 3 — ingestion
        ingest = cdc + [n for n in roles("streaming", "stream-processing") if not self._legacy(n)]
        for n in ingest:
            feeders = [arch.node(e.source) for e in arch.edges if e.target == n.id and arch.node(e.source)]
            W["wave-3"].activities.append(item(f"Configure {self._name(n)}", f"From {names(feeders)}" if feeders else "", [n, *feeders]))
        landing = [n for n in roles("lake-layer") if (self.ontology.get(n.tech_id).stage or "") in {"landing", "bronze", "raw"}]
        for n in landing:
            W["wave-3"].activities.append(item(f"Land data in {self._name(n)}", "", [n]))
        W["wave-3"].exit_criteria = ["CDC lag within agreed SLA for 5 consecutive business days"]
        W["wave-3"].skills = skills(ingest)

        # Wave 4 — historical
        sources = [n for n in legacy if self._role(n) in {"source-database", "legacy-warehouse", "mainframe", "file-source"}]
        vol = f" (~{estate.data_volume_tb:g} TB)" if estate and estate.data_volume_tb else ""
        for n in sources:
            W["wave-4"].activities.append(item(f"Bulk-migrate history from {self._name(n)}{vol}",
                                               "Partition by date/table; checksum each partition.", [n]))
        W["wave-4"].exit_criteria = ["All historical partitions loaded and checksummed", "CDC resumed from the export point without gaps"]
        W["wave-4"].risks = ["Historical data volume and transfer windows"]

        # Wave 5 — transformation
        transforms = [n for n in modern if n.replaces and self._role(n) in {"transformation", "etl", "orchestrator", "processing", "application", "stream-processing"}]
        for n in transforms:
            for old in n.replaces:
                maps = self.ontology.mappings_between(old, n.tech_id) or self.ontology.mappings_for(old)
                detail = ""
                if maps:
                    m = maps[0]
                    detail = f"Automation potential: {m.automation_potential}. Manual effort: {', '.join(m.manual_effort_areas[:2])}."
                    for r in m.risks[:2]:
                        rd = self.ontology.data.risks.get(r)
                        if rd and rd.title not in W["wave-5"].risks:
                            W["wave-5"].risks.append(rd.title)
                old_name = self.ontology.get(old).name if self.ontology.get(old) else old
                W["wave-5"].activities.append(item(f"Convert {old_name} → {self._name(n)}", detail, [n]))
        if not transforms:
            for n in [n for n in roles("transformation") if not self._legacy(n)]:
                W["wave-5"].activities.append(item(f"Build pipelines in {self._name(n)}", "", [n]))
        W["wave-5"].exit_criteria = ["Converted pipelines produce outputs matching legacy within tolerance on test data"]
        W["wave-5"].skills = skills(transforms) or skills(roles("transformation"))

        # Wave 6 — consumption
        consumers = roles("serving", "bi", "api", "ml")
        for n in consumers:
            verb = "Repoint" if self._legacy(n) or (n.strategy or n.suggested_strategy) == "retain" else "Roll out"
            W["wave-6"].activities.append(item(f"{verb} {self._name(n)}", "", [n]))
        W["wave-6"].exit_criteria = ["Priority reports validated by business users against legacy outputs"]
        W["wave-6"].skills = skills(consumers)

        # Wave 7 — reconciliation
        dq = roles("data-quality")
        if dq:
            for n in dq:
                W["wave-7"].activities.append(item(f"Run {self._name(n)} checks", "Row counts, checksums, aggregates and sampled field comparisons.", [n]))
        else:
            W["wave-7"].activities.append(item("Introduce a reconciliation capability",
                                               "No reconciliation component is on the canvas — the validator flags this."))
            W["wave-7"].risks.append("No automated reconciliation component in the architecture")
        W["wave-7"].exit_criteria = ["Reconciliation passes for all in-scope tables across three consecutive runs"]

        # Wave 8 — parallel run
        W["wave-8"].activities.append(item("Run legacy and target in parallel for an agreed number of business cycles",
                                           "Including month-end if finance reporting is in scope.", sources))
        W["wave-8"].exit_criteria = ["Variance report signed off by data owners"]
        W["wave-8"].risks = ["Double running cost during parallel run"]

        # Wave 9 — cutover
        for i, n in enumerate(legacy, 1):
            W["wave-9"].activities.append(item(f"Step {i}: cut over {self._name(n)}", "", [n]))
        W["wave-9"].activities.append(item("Rollback: keep legacy read-only and CDC reversible until hypercare exit"))
        downtime = estate and estate.has("minimize-downtime")
        W["wave-9"].exit_criteria = ["Consumers on target", "Rollback window closed by agreement"]
        if downtime:
            W["wave-9"].goal += " CDC keeps the target current so the switch window is minutes, not days."

        # Wave 10 — hypercare
        obs = roles("observability")
        W["wave-10"].activities.append(item("Heightened monitoring of SLAs, CDC lag and job failures", "", obs))
        W["wave-10"].exit_criteria = ["Two weeks without P1 incidents", "Runbooks handed to operations"]

        # Wave 11 — decommission
        for n in legacy:
            strat = n.strategy or n.suggested_strategy
            if strat == "retain" and self._role(n) in {"source-database"}:
                continue
            W["wave-11"].activities.append(item(f"Decommission {self._name(n)}", "Archive per retention policy; terminate licences.", [n]))
        W["wave-11"].exit_criteria = ["Licences terminated", "Infrastructure removed", "Archive verified readable"]

        for w in waves:
            if not w.activities:
                w.included = False
        themes = self.themes(arch)
        return Roadmap(architecture_id=arch_id, waves=waves, dependencies=deps, themes=themes)

    def themes(self, arch: Architecture) -> list[str]:
        out = []
        roles = {self._role(n) for n in arch.nodes}
        if any(self._role(n) == "cdc" and not self._legacy(n) for n in arch.nodes):
            out.append("Change data capture for low-downtime migration")
        if any(n.replaces and self._role(n) in {"transformation", "etl"} for n in arch.nodes):
            out.append("Proprietary ETL replaced by code-first, version-controlled pipelines")
        if "governance" in roles:
            gov = [self._name(n) for n in arch.nodes if self._role(n) == "governance"]
            out.append(f"Governance by default with {', '.join(gov[:2])}")
        if any(self._legacy(n) and self._role(n) == "orchestrator" for n in arch.nodes):
            out.append("Coexistence: legacy scheduling retained until cutover")
        if "streaming" in roles:
            out.append("Event streaming for near-real-time data")
        if any(self._role(n) == "bi" and (n.strategy or n.suggested_strategy) == "retain" for n in arch.nodes):
            out.append("Protect the reporting investment: BI repointed, not rebuilt")
        if any(self.ontology.get(n.tech_id) and self.ontology.get(n.tech_id).operational_model in {"managed", "serverless"} for n in arch.nodes):
            out.append("Shift from self-managed infrastructure to managed services")
        return out
