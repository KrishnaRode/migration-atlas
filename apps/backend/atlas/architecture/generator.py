"""Deterministic target-architecture generator (steps 1–3 of the hybrid pipeline).

Builds a first-cut architecture purely from the ontology: the estate's technologies, the
target cloud/platform building blocks in ontology/platforms.yaml, and each legacy
technology's `possible_targets` / `suggested_next`. Nothing here is specific to any one
source or target — Oracle→Databricks is just one combination the data happens to support.

Migration-time scaffolding (reconciliation, parallel run, cutover) is intentionally *not*
added: the target state describes steady state, and the validator raises those as findings
so the team decides how to run the migration.
"""

from __future__ import annotations

from dataclasses import dataclass

from atlas.architecture.ops import ArchitectureBuilder
from atlas.models.architecture import Architecture, ArchitectureNode, ArchitectureRisk
from atlas.models.ontology import CloudBlocks, DataPlatformBlocks, Technology
from atlas.models.project import Estate
from atlas.ontology.service import OntologyService
from atlas.rules.connections import ConnectionEngine

DATA_SOURCE_ROLES = {"source-database", "legacy-warehouse", "file-source"}
MAINFRAME_DATA = {"ibm-db2-zos", "vsam", "ims"}
CLOUD_LABEL = {"gcp": "GCP", "aws": "AWS", "azure": "Azure"}


@dataclass
class Targets:
    cloud_id: str
    cloud: CloudBlocks
    platform_id: str
    platform: DataPlatformBlocks


class ArchitectureGenerator:
    def __init__(self, ontology: OntologyService, engine: ConnectionEngine):
        self.ontology = ontology
        self.engine = engine
        self.platforms = ontology.data.platforms
        self._excluded: set[str] = set()

    # ------------------------------------------------------------------ targets
    def resolve_targets(self, estate: Estate) -> Targets:
        clouds = self.platforms.clouds
        cloud_id = estate.target_cloud if estate.target_cloud in clouds else None
        targets = [t for t in estate.target_platforms if self.ontology.exists(t)]
        if cloud_id is None:
            for t in targets:
                if t in clouds:
                    cloud_id = t
                    break
                tech = self.ontology.require(t)
                if tech.role == "cloud-platform" and tech.id in clouds:
                    cloud_id = tech.id
                    break
        if cloud_id is None:
            for t in targets:
                tech_clouds = [c for c in self.ontology.require(t).clouds if c in clouds]
                if len(tech_clouds) == 1:
                    cloud_id = tech_clouds[0]
                    break
        cloud_id = cloud_id or "gcp"

        platform_id = None
        for t in targets:
            block = self.platforms.data_platforms.get(t)
            if block and cloud_id in block.clouds:
                platform_id = t
                break
        platform_id = platform_id or self.platforms.default_data_platform.get(cloud_id, "bigquery")
        return Targets(cloud_id, clouds[cloud_id], platform_id, self.platforms.data_platforms[platform_id])

    # ------------------------------------------------------------------ helpers
    def _compatible(self, tech: Technology, t: Targets) -> bool:
        if tech.platforms and t.platform_id not in tech.platforms:
            return False
        return tech.runs_on(t.cloud_id)

    def _pick(self, candidates: list[str], t: Targets, roles: set[str]) -> str | None:
        for cid in candidates:
            if cid in self._excluded:
                continue
            tech = self.ontology.get(cid)
            if tech and tech.role in roles and not tech.legacy and self._compatible(tech, t):
                return cid
        return None

    def _cdc_for(self, source: Technology, t: Targets) -> str | None:
        if source.role == "legacy-warehouse":
            # Log-based CDC rarely exists for MPP appliances; only use tools the source itself lists.
            return self._pick(source.suggested_next, t, {"cdc"})
        preferred = [*t.platform.get_list("cdc"), *t.cloud.get_list("cdc")]
        # A source's own suggestions encode real-world fit (e.g. GoldenGate for Oracle); prefer
        # platform-native tooling when the source lists it, then the source's other picks.
        ordered = [c for c in preferred if c in source.suggested_next]
        ordered += [c for c in source.suggested_next if c not in ordered]
        ordered += [c for c in preferred if c not in ordered]
        return self._pick(ordered, t, {"cdc"})

    def _modern_target(self, legacy: Technology, t: Targets, roles: set[str], native: list[str]) -> str | None:
        """The modern replacement for a legacy component: platform-native first if it's a listed target."""
        listed = legacy.possible_targets
        ordered = [n for n in native if n in listed] + list(listed) + native
        return self._pick(ordered, t, roles)

    # ------------------------------------------------------------------ generate
    def generate(self, estate: Estate, name: str | None = None) -> Architecture:
        self._excluded = set(estate.exclude_technologies)
        retained = set(estate.retain_technologies)
        t = self.resolve_targets(estate)
        b = ArchitectureBuilder(self.ontology, self.engine)
        arch = b.arch
        cloud_label = CLOUD_LABEL.get(t.cloud_id, t.cloud.name)
        arch.name = name or f"{cloud_label} + {t.platform.name}"
        arch.meta.target_cloud = t.cloud_id
        arch.meta.data_platform = t.platform_id
        arch.meta.generated_by = "rules"

        estate_techs = [self.ontology.get(i) for i in dict.fromkeys(estate.current_technologies)]
        estate_techs = [x for x in estate_techs if x is not None]
        by_role: dict[str, list[Technology]] = {}
        for tech in estate_techs:
            by_role.setdefault(tech.role, []).append(tech)

        downtime = estate.has("minimize-downtime")
        realtime = estate.has("near-real-time")
        min_rewrite = estate.has("minimize-rewrite", "high")
        keep_skills = estate.has("retain-skills", "high")
        reduce_licensing = estate.has("reduce-licensing", "medium")
        strict_gov = estate.has("strict-governance", "medium") or estate.has("regulatory", "medium")
        open_arch = estate.has("avoid-lock-in", "medium") or estate.has("open-architecture", "medium")
        notes, assumptions, risks = arch.architecture_notes, arch.assumptions, arch.risks

        # ---- storage zones and platform ------------------------------------------
        storage_id = t.cloud.get("object_storage")
        storage_name = self.ontology.require(storage_id).name if storage_id else "object storage"
        zones: list[ArchitectureNode] = []
        for zone_id in t.platform.zones:
            label = None
            if self.ontology.require(zone_id).stage == "landing":
                label = f"Landing · {storage_name}"
            zone = b.add(zone_id, label=label, environment=cloud_label, hosted_on=storage_id)
            if zones:
                b.connect(zones[-1], zone)
            zones.append(zone)
        landing = zones[0] if zones else None
        first_layer = zones[1] if len(zones) > 1 else landing
        last_layer = zones[-1] if zones else None
        if landing and first_layer and t.platform.get("file_ingestion"):
            edge = next((e for e in arch.edges if e.source == landing.id and e.target == first_layer.id), None)
            if edge:
                edge.label = self.ontology.require(t.platform.get("file_ingestion")).name
                edge.mode = "batch"

        platform_node = b.add(t.platform_id, environment=cloud_label)
        if t.platform.kind == "lakehouse" and first_layer:
            b.connect(platform_node, first_layer, kind="control", label="runs on")
        notes.append(
            f"{t.platform.name} on {t.cloud.name} is the target data platform; data flows through "
            + " → ".join(self.ontology.require(z.tech_id).name for z in zones)
            + "."
        )

        # ---- sources and ingestion -----------------------------------------------
        cdc_nodes: list[ArchitectureNode] = []
        streaming_node = None
        legacy_messaging = by_role.get("streaming", [])
        needs_streaming = realtime or any(m.legacy for m in legacy_messaging)
        if needs_streaming:
            stream_id = None
            if open_arch:
                stream_id = self._pick(["apache-kafka", "confluent-cloud", t.cloud.get("managed_kafka") or ""], t, {"streaming"})
            stream_id = stream_id or self._pick([t.cloud.get("streaming") or "", t.cloud.get("managed_kafka") or "",
                                                 "apache-kafka", "confluent-cloud"], t, {"streaming"})
            if stream_id:
                streaming_node = b.add(stream_id, environment=cloud_label)
                notes.append(f"{self.ontology.require(stream_id).name} provides the event backbone for near-real-time flows.")

        def ingest_to(node: ArchitectureNode) -> ArchitectureNode | None:
            return streaming_node or landing

        source_nodes: list[ArchitectureNode] = []
        for tech in estate_techs:
            is_data_source = tech.role in DATA_SOURCE_ROLES or tech.id in MAINFRAME_DATA
            if not is_data_source:
                continue
            src = b.add(tech.id, origin="rules")
            source_nodes.append(src)
            if tech.role == "legacy-warehouse":
                src.suggested_strategy = "retire"
                if landing:
                    b.connect(src, landing, label="Historical export", mode="batch", frequency="one-time")
                cdc_id = self._cdc_for(tech, t) if downtime else None
                if cdc_id:
                    cdc = b.add(cdc_id, environment=cloud_label)
                    cdc_nodes.append(cdc)
                    b.connect(src, cdc, label="Incremental", mode="cdc", frequency="continuous")
                continue
            if tech.role == "file-source":
                src.suggested_strategy = "retain"
                if landing:
                    b.connect(src, landing, mode="file")
                continue
            # operational databases and mainframe data stores
            src.suggested_strategy = "retain" if tech.id in MAINFRAME_DATA else "replatform"
            cdc_id = self._cdc_for(tech, t)
            if cdc_id:
                cdc = b.add(cdc_id, environment=cloud_label)
                if cdc not in cdc_nodes:
                    cdc_nodes.append(cdc)
                b.connect(src, cdc, label="CDC", mode="cdc", frequency="continuous", format="change records",
                          latency="near real time" if (realtime or downtime) else "minutes")
            elif landing:
                b.connect(src, landing, label="Batch extract", mode="batch")
            if tech.id in MAINFRAME_DATA:
                risks.append(ArchitectureRisk(
                    title=f"{tech.name} data needs EBCDIC/copybook conversion",
                    detail="Packed decimals, REDEFINES and code pages must be converted and reconciled field by field.",
                    severity="high", related_nodes=[src.id], source="ontology"))

        for cdc in cdc_nodes:
            target = ingest_to(cdc)
            cdc_tech = self.ontology.require(cdc.tech_id)
            if target is streaming_node and target is not None:
                b.connect(cdc, target, mode="cdc", label="Change events")
            elif cdc_tech.platforms and first_layer and first_layer is not landing and "databricks" in cdc_tech.platforms:
                b.connect(cdc, landing or first_layer, mode="cdc")
            elif target is not None:
                b.connect(cdc, target, mode="cdc")
        if streaming_node:
            sp_id = t.platform.get("stream_processing") or t.cloud.get("stream_processing")
            sink = first_layer or landing
            if sp_id and sink and self.ontology.exists(sp_id):
                sp = b.add(sp_id, environment=cloud_label)
                b.connect(streaming_node, sp, mode="streaming")
                b.connect(sp, sink, mode="streaming", latency="seconds")
            elif sink:
                b.connect(streaming_node, sink, mode="streaming")
        if downtime and cdc_nodes:
            notes.append("Change data capture keeps the target in sync during migration so cutover can be a short switch rather than a long freeze.")

        # Legacy messaging is replaced by the cloud backbone; producers are applications.
        for legacy_mq in [m for m in legacy_messaging if m.legacy]:
            mq = b.add(legacy_mq.id)
            mq.suggested_strategy = "replatform"
            if streaming_node:
                b.connect(mq, streaming_node, label="Bridge during coexistence", mode="streaming")

        # ---- applications and mainframe runtime ---------------------------------
        runtime = [x for x in by_role.get("mainframe", []) + by_role.get("application", []) if x.id not in MAINFRAME_DATA]
        if runtime:
            runtime_nodes = {x.id: b.add(x.id) for x in runtime}
            data_nodes = [n for n in source_nodes if n.tech_id in MAINFRAME_DATA
                          or self.ontology.require(n.tech_id).role == "source-database"]
            jcl = runtime_nodes.get("jcl")
            programs = [n for tid, n in runtime_nodes.items() if tid != "jcl"]
            for prog in programs:
                prog.suggested_strategy = "refactor" if self.ontology.require(prog.tech_id).role == "mainframe" else "replatform"
                for data in data_nodes[:2]:
                    b.connect(prog, data, label="reads / writes")
                if jcl:
                    b.connect(jcl, prog, kind="control", label="runs batch")
            # Modernised services: the application tier lands on the cloud's Kubernetes with a managed OLTP store.
            k8s_id, oltp_id = t.cloud.get("kubernetes"), t.cloud.get("oltp")
            if programs and k8s_id and self.ontology.exists("java"):
                k8s = b.add(k8s_id, environment=cloud_label)
                svc = b.add("java", label="Modernized services (Java)", environment=cloud_label, reuse=False, origin="rules")
                svc.replaces.extend(p.tech_id for p in programs)
                b.connect(k8s, svc, label="hosts")
                if oltp_id:
                    oltp = b.add(oltp_id, environment=cloud_label)
                    oltp.replaces.extend(n.tech_id for n in data_nodes)
                    b.connect(svc, oltp, label="reads / writes")
                    for cdc in cdc_nodes[:1]:
                        b.connect(cdc, oltp, label="Data sync during coexistence", mode="cdc")
                if streaming_node:
                    b.connect(svc, streaming_node, label="Domain events", mode="streaming")
                notes.append("Mainframe programs are refactored into services on Kubernetes with a managed relational store; "
                             "CDC keeps mainframe data in sync while functionality moves in slices.")
            if jcl:
                jcl.suggested_strategy = "refactor"
                target_id = self._modern_target(self.ontology.require("jcl"), t, {"orchestrator"}, [t.cloud.get("scheduler") or ""])
                if target_id:
                    orch = b.add(target_id, environment=cloud_label)
                    orch.replaces.append("jcl")
                    if programs and self.ontology.exists("java"):
                        b.connect(orch, svc, kind="control", label="schedules")

        # ---- transformation (legacy ETL) -----------------------------------------
        transform_native = t.platform.get("transformation")
        transformation_nodes: list[ArchitectureNode] = []
        for etl in by_role.get("etl", []):
            if (min_rewrite or etl.id in retained) and etl.legacy:
                node = b.add(etl.id, label=f"{etl.name} (rehosted)")
                node.suggested_strategy = "rehost"
                for src in source_nodes:
                    if self.ontology.require(src.tech_id).role in {"source-database", "legacy-warehouse"}:
                        b.connect(src, node, mode="batch")
                if first_layer:
                    b.connect(node, first_layer, mode="batch")
                notes.append(f"{etl.name} is retained (rehosted) to minimise rewrite; its mappings are repointed at the new platform.")
                risks.append(ArchitectureRisk(title=f"Retaining {etl.name} keeps legacy licensing and skills dependency",
                                              severity="medium", related_nodes=[node.id], source="rules"))
                continue
            target_id = self._modern_target(etl, t, {"transformation", "etl", "stream-processing"},
                                            [transform_native] if transform_native else [])
            if not target_id:
                continue
            node = b.add(target_id, environment=cloud_label)
            node.replaces.append(etl.id)
            transformation_nodes.append(node)
            mappings = self.ontology.mappings_between(etl.id, target_id)
            notes.append(
                f"{etl.name} logic is re-implemented in {self.ontology.require(target_id).name}"
                + (f" ({mappings[0].automation_potential} automation potential)." if mappings else ".")
            )
            risks.append(ArchitectureRisk(title=f"Business logic embedded in {etl.name} mappings",
                                          detail="Expressions, lookups and reusable transformations hide rules that must be inventoried before conversion.",
                                          severity="high", related_nodes=[node.id], source="ontology"))
        if not transformation_nodes and transform_native and len(zones) > 2:
            transformation_nodes.append(b.add(transform_native, environment=cloud_label))
        for node in transformation_nodes:
            for z in zones[2:]:
                b.connect(node, z, label="builds")
                b.connect(platform_node, node, kind="control", label="runs")

        # ---- orchestration --------------------------------------------------------
        native_orch = t.platform.get("orchestration") or t.cloud.get("orchestration")
        orchestrators: list[ArchitectureNode] = []
        legacy_schedulers = by_role.get("orchestrator", [])
        for sched in legacy_schedulers:
            retain = sched.id in retained or (sched.legacy and (downtime or keep_skills or min_rewrite) and sched.id != "cron")
            if retain:
                node = b.add(sched.id)
                node.suggested_strategy = "retain"
                notes.append(
                    f"{sched.name} is retained during coexistence so existing batch dependencies keep running while workloads move; "
                    f"plan its replacement with a cloud-native orchestrator once cutover is complete."
                )
                risks.append(ArchitectureRisk(title=f"{sched.name} must reach cloud jobs securely",
                                              detail="Agents or API integrations need network paths and credentials into the target platform.",
                                              severity="medium", related_nodes=[node.id], source="rules"))
            else:
                target_id = self._modern_target(sched, t, {"orchestrator"}, [native_orch] if native_orch else [])
                if not target_id:
                    continue
                node = b.add(target_id, environment=cloud_label)
                node.replaces.append(sched.id)
            orchestrators.append(node)
        if not orchestrators and native_orch:
            orchestrators.append(b.add(native_orch, environment=cloud_label))
        for orch in orchestrators:
            for job in transformation_nodes or [platform_node]:
                b.connect(orch, job, kind="control", label="schedules")

        # ---- serving and consumption ---------------------------------------------
        serving_id = t.platform.get("serving")
        serving = None
        if serving_id and serving_id != t.platform_id:
            serving = b.add(serving_id, environment=cloud_label)
            if last_layer:
                b.connect(last_layer, serving, mode="query")
        consumer_source = serving or last_layer
        bi_tools = by_role.get("bi", [])
        for bi in bi_tools:
            replace = (bi.legacy and (reduce_licensing or bi.id in {"cognos", "business-objects", "microstrategy"})
                       and not min_rewrite and bi.id not in retained)
            if replace:
                target_id = self._modern_target(bi, t, {"bi"}, [t.cloud.get("bi") or ""])
                node = b.add(target_id or bi.id, environment=cloud_label if target_id else None)
                if target_id:
                    node.replaces.append(bi.id)
                    risks.append(ArchitectureRisk(title=f"Report parity when moving off {bi.name}",
                                                  severity="medium", related_nodes=[node.id], source="ontology"))
            else:
                node = b.add(bi.id)
                node.suggested_strategy = "retain"
                node.environment = "SaaS / Desktop" if not bi.legacy else node.environment
                notes.append(f"{bi.name} is retained and repointed at the new serving layer.")
            if consumer_source:
                b.connect(consumer_source, node, mode="query")
        if not bi_tools and consumer_source and t.cloud.get("bi"):
            b.connect(consumer_source, b.add(t.cloud.get("bi"), environment=cloud_label), mode="query")

        # ---- cross-cutting --------------------------------------------------------
        governance_id = t.platform.get("governance") or t.cloud.get("governance")
        if governance_id:
            gov = b.add(governance_id, environment=cloud_label)
            for target in [platform_node, *( [serving] if serving else [] )]:
                b.connect(gov, target, kind="governance", label="governs")
        if strict_gov and t.cloud.get("governance") and t.cloud.get("governance") != governance_id:
            b.connect(b.add(t.cloud.get("governance"), environment=cloud_label), platform_node, kind="governance")

        secrets_id = t.cloud.get("secrets")
        if secrets_id and (cdc_nodes or transformation_nodes):
            secrets = b.add(secrets_id, environment=cloud_label)
            for consumer in [*cdc_nodes, *orchestrators[:1]]:
                b.connect(secrets, consumer, kind="security", label="credentials")
        if strict_gov:
            ident = t.cloud.get("identity")
            if ident:
                b.connect(b.add(ident, environment=cloud_label), platform_node, kind="security", label="identity")
            kms = t.cloud.get("key_management")
            if kms and kms != secrets_id:
                b.connect(b.add(kms, environment=cloud_label), platform_node, kind="security", label="encryption keys")

        on_prem_sources = [n for n in source_nodes if self.ontology.require(n.tech_id).environment == "on-prem"]
        if on_prem_sources and t.cloud.get("hybrid_network"):
            net = b.add(t.cloud.get("hybrid_network"), environment=f"On-Prem ↔ {cloud_label}")
            for consumer in cdc_nodes[:2] or [landing] if landing else []:
                b.connect(net, consumer, kind="security", label="private link")

        monitoring_id = t.cloud.get("monitoring")
        if monitoring_id:
            mon = b.add(monitoring_id, environment=cloud_label)
            for target in [platform_node, *cdc_nodes[:2], *(streaming_node and [streaming_node] or [])]:
                b.connect(mon, target, kind="monitoring", label="metrics & alerts")

        ci_id = t.platform.get("ci_cd") or t.cloud.get("ci_cd")
        if ci_id:
            ci = b.add(ci_id, environment=cloud_label)
            b.connect(ci, platform_node, kind="control", label="deploys")

        if estate.has("disaster-recovery", "medium"):
            dr = b.add("cross-region-dr", environment=cloud_label)
            b.connect(dr, platform_node, label="replicates")
        if estate.has("high-availability", "high"):
            assumptions.append("High availability relies on managed-service SLAs; multi-zone deployment is assumed for self-managed components.")

        # ---- assumptions ----------------------------------------------------------
        if estate.data_volume_tb:
            assumptions.append(f"Approximately {estate.data_volume_tb:g} TB of historical data is moved by bulk export, separately from ongoing CDC.")
            if estate.data_volume_tb >= 100:
                risks.append(ArchitectureRisk(title="Historical data volume",
                                              detail=f"{estate.data_volume_tb:g} TB needs a transfer plan (network bandwidth or offline transfer appliance) and partitioned reconciliation.",
                                              severity="high", source="rules"))
        if on_prem_sources:
            assumptions.append(f"Private connectivity between the data centre and {t.cloud.name} is available or provisioned in Wave 1.")
        if cdc_nodes:
            assumptions.append("Source databases can enable the logging CDC requires (e.g. supplemental/archive logging) without breaching performance SLAs.")
        assumptions.append("Target-state components are shown; migration scaffolding (reconciliation, parallel run, cutover) is planned separately.")
        return arch
