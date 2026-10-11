# Technology Ontology

Migration Atlas does not draw boxes — it reasons about what the boxes *are*. All of that
knowledge lives in plain YAML files under [`ontology/`](../ontology) and
[`patterns/`](../patterns), loaded and validated by the backend at startup
(`apps/backend/atlas/ontology/`). The frontend never hardcodes technology facts; it reads
them through `/technologies`, `/patterns`, `/ontology/*`.

Edit a YAML file, restart the backend, and the component library, connection rules,
generator, validator and knowledge graph all pick up the change.

## Files

| File | Holds |
| --- | --- |
| `ontology/categories.yaml` | Component-library categories (display order, icon, colour) |
| `ontology/technologies/*.yaml` | One list of `Technology` entries per file (grouped by domain) |
| `ontology/connection_rules.yaml` | Role-to-role and technology-specific connection rules |
| `ontology/platforms.yaml` | Per-cloud and per-data-platform building blocks used by the generator |
| `ontology/mappings.yaml` | Source → target migration mappings (systems and artefacts) |
| `ontology/strategies.yaml` | The 8 migration strategies (Retain … Rearchitect) |
| `ontology/risks.yaml` | Reusable migration risk catalogue |
| `ontology/constraints.yaml` | Migration requirement vocabulary + NL keywords |
| `patterns/*.yaml` | Architecture patterns with diagram templates |

## Technology

```yaml
- id: informatica-powercenter          # kebab-case, globally unique, never renamed
  name: Informatica PowerCenter
  aliases: [powercenter, informatica, infa pc]   # lower-case, used by the NL estate parser
  vendor: Informatica
  category: ETL                        # must be an id in categories.yaml
  role: etl                            # see "Roles" — drives connection intelligence
  layer: processing                    # default swimlane — see "Layers"
  environment: on-prem                 # on-prem | cloud | saas | hybrid | any
  legacy: true                         # true for estate/legacy technologies
  clouds: [on-prem]                    # where it can run: on-prem, aws, azure, gcp, any
  stage: null                          # only for lake layers: landing | bronze | silver | gold | raw | staging | curated
  platforms: []                        # data platforms this tool is tied to (e.g. lakeflow-connect: [databricks]); [] = any
  operational_model: self-managed      # self-managed | managed | serverless | saas
  icon: workflow                       # lucide-react icon name (kebab-case)
  color: "#FF4D00"                     # brand-ish accent for the node chip
  description: One sentence, what it is.
  typical_legacy_use: One or two sentences on how enterprises typically use it.
  capabilities: [batch-etl, workflow-orchestration, data-transformation]
  possible_targets: [lakeflow-declarative-pipelines, dbt, apache-airflow, google-dataflow, azure-data-factory]
  alternatives: [ibm-datastage, talend]          # peers in the same role
  replaces: []                         # legacy tech this commonly replaces (for modern tech)
  suggested_next: [lakeflow-declarative-pipelines, dbt]   # smart suggestions when dropped on canvas
  migration_considerations:
    - Mappings and mapplets must be inventoried; reusable transformations hide logic.
  known_challenges:
    - Custom Java transformations and stored-procedure calls need manual rewrite.
  risks: [hidden-business-logic, skills-gap]   # ids from risks.yaml
  strategies: [retain, rehost, replatform, refactor, retire]   # ids from strategies.yaml
  skills: [Informatica development, SQL]
  tags: [etl, batch, legacy]
  docs:                                # official documentation landing pages only
    - title: Informatica PowerCenter documentation
      url: https://docs.informatica.com/data-integration/powercenter.html
```

Required: `id, name, vendor, category, role, layer, description, capabilities`.
Every id referenced in `possible_targets`, `alternatives`, `replaces`, `suggested_next`
must exist; the loader reports dangling references (and the test suite fails on them).

## Roles

Roles are the vocabulary of connection intelligence. A technology has exactly one.

| Role | Meaning | Examples |
| --- | --- | --- |
| `source-database` | Operational or analytical database holding source data | Oracle, SQL Server, DB2 |
| `legacy-warehouse` | MPP warehouse appliance in the estate | Teradata, Netezza, Exadata, Greenplum |
| `mainframe` | Mainframe platform / runtime / language / dataset | z/OS, COBOL, CICS, VSAM, JCL |
| `application` | Application runtime / framework / app server | Java, .NET, WebLogic |
| `file-source` | Flat files, SFTP drops | SFTP, file shares |
| `etl` | Batch extract-transform-load tooling | Informatica, DataStage, SSIS, ADF |
| `cdc` | Change data capture / replication | GoldenGate, Datastream, DMS, Lakeflow Connect |
| `streaming` | Event streaming / messaging backbone | Kafka, Pub/Sub, Event Hubs, Kinesis, IBM MQ |
| `stream-processing` | Stream processors | Dataflow, Flink, Spark Structured Streaming |
| `object-storage` | Cloud object storage | GCS, S3, ADLS |
| `lake-layer` | A logical zone of a lake/lakehouse (uses `stage`) | Landing, Bronze, Silver, Gold |
| `lakehouse` | Lakehouse / Spark platform | Databricks, Delta Lake |
| `warehouse` | Cloud data warehouse | BigQuery, Snowflake, Redshift, Synapse |
| `processing` | Batch compute engine | Spark, Dataproc, EMR |
| `transformation` | In-warehouse/lakehouse transformation frameworks | dbt, Lakeflow Declarative Pipelines, Dataform |
| `orchestrator` | Schedulers / workflow orchestration | Control-M, AutoSys, Airflow, Databricks Workflows |
| `serving` | SQL serving / query endpoints / semantic layer | Databricks SQL |
| `bi` | BI / reporting / dashboards | Tableau, Power BI, Looker, Cognos |
| `governance` | Catalog, lineage, access policy | Unity Catalog, Dataplex, Purview, Collibra |
| `data-quality` | Data quality / reconciliation | Reconciliation framework, Great Expectations |
| `security` | Secrets, keys, identity, network security | Secret Manager, Key Vault, IAM, KMS |
| `observability` | Monitoring / logging / alerting | Cloud Monitoring, CloudWatch, Datadog |
| `devops` | CI/CD and IaC | Terraform, GitHub Actions, Azure DevOps |
| `container` | Containers and orchestration | Docker, Kubernetes, GKE |
| `api` | API gateways / API layers | Apigee, API Gateway |
| `ml` | ML platform / model lifecycle | MLflow, Vertex AI, SageMaker |
| `network` | Cloud networking / connectivity | Interconnect, Direct Connect, ExpressRoute, VPN |
| `cloud-platform` | A hyperscaler as a whole | AWS, Azure, Google Cloud |

## Layers (swimlanes)

`sources · ingestion · storage · processing · serving · consumption · governance · security · operations`

## Connection rules

Each rule matches a `from` and `to` by role (`role:<x>`), technology id (`tech:<id>`),
lake stage (`stage:<x>`), or `*`. The most specific matching rule wins
(tech > stage > role > `*`). Statuses: `VALID`, `VALID_WITH_WARNING`, `UNUSUAL`,
`INVALID`, `UNKNOWN`. Every rule carries a human `reason`, an optional `suggestion`, and a
`kind` (`data`, `control`, `governance`, `security`, `monitoring`) used as the default
edge semantics.

## Mappings

```yaml
- id: oracle-to-databricks
  source: oracle-database               # technology id
  source_artifact: null                 # or e.g. "PL/SQL stored procedures"
  targets: [databricks, databricks-sql]
  approaches: [...]
  conversion_considerations: [...]
  risks: [...]
  automation_potential: medium          # low | medium | high
  manual_effort_areas: [...]
```
