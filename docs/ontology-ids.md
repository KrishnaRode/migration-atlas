# Canonical ontology ids (seed set)

Authoring contract for the seed ontology. Each file lists the technology ids it owns as
`id (category, role[, stage])`. Any file may reference any id here.

## ontology/technologies/databases.yaml
oracle-database (databases, source-database) · sql-server (databases, source-database) ·
postgresql (databases, source-database) · mysql (databases, source-database) ·
ibm-db2 (databases, source-database) · teradata (databases, legacy-warehouse) ·
netezza (databases, legacy-warehouse) · sybase-ase (databases, source-database) ·
greenplum (databases, legacy-warehouse) · oracle-exadata (databases, legacy-warehouse) ·
alloydb (databases, source-database — modern target) · cloud-sql (databases, source-database — modern target) ·
amazon-aurora (databases, source-database — modern target) · azure-sql-database (databases, source-database — modern target)

## ontology/technologies/mainframe.yaml
ibm-zos (mainframe, mainframe) · cobol (mainframe, mainframe) · cics (mainframe, mainframe) ·
vsam (mainframe, mainframe) · jcl (mainframe, mainframe) · ibm-db2-zos (mainframe, source-database) ·
ims (mainframe, mainframe)

## ontology/technologies/applications.yaml
java (applications, application) · dotnet (applications, application) · spring (applications, application) ·
weblogic (applications, application) · websphere (applications, application)

## ontology/technologies/source_systems.yaml
sap-erp (source-systems, file-source) · salesforce (source-systems, file-source) ·
flat-files-sftp (source-systems, file-source)

## ontology/technologies/etl.yaml
informatica-powercenter (etl, etl) · ibm-datastage (etl, etl) · ssis (etl, etl) · talend (etl, etl) ·
ab-initio (etl, etl) · pentaho (etl, etl) · azure-data-factory (etl, etl) · aws-glue (etl, etl) ·
google-cloud-data-fusion (etl, etl) · informatica-idmc (etl, etl)

## ontology/technologies/cdc.yaml
oracle-goldengate (cdc, cdc) · lakeflow-connect (cdc, cdc; platforms [databricks]) ·
google-datastream (cdc, cdc) · aws-dms (cdc, cdc) · azure-dms (cdc, cdc) · debezium (cdc, cdc) ·
qlik-replicate (cdc, cdc) · striim (cdc, cdc) · snowpipe (cdc, cdc; platforms [snowflake]) ·
databricks-auto-loader (cdc, cdc; platforms [databricks])

## ontology/technologies/orchestration.yaml
control-m (orchestration, orchestrator) · autosys (orchestration, orchestrator) · tidal (orchestration, orchestrator) ·
cron (orchestration, orchestrator) · apache-airflow (orchestration, orchestrator) ·
cloud-composer (orchestration, orchestrator) · amazon-mwaa (orchestration, orchestrator) ·
databricks-workflows (orchestration, orchestrator; platforms [databricks]) ·
aws-step-functions (orchestration, orchestrator) · google-cloud-scheduler (orchestration, orchestrator)

## ontology/technologies/messaging_streaming.yaml
ibm-mq (messaging, streaming) · rabbitmq (messaging, streaming) · activemq (messaging, streaming) ·
apache-kafka (streaming, streaming) · confluent-cloud (streaming, streaming) · amazon-msk (streaming, streaming) ·
google-pubsub (streaming, streaming) · azure-event-hubs (streaming, streaming) · amazon-kinesis (streaming, streaming)

## ontology/technologies/storage_lake.yaml
google-cloud-storage (storage, object-storage) · amazon-s3 (storage, object-storage) · adls-gen2 (storage, object-storage) ·
landing-zone (data-lake, lake-layer, landing) · delta-bronze (data-lake, lake-layer, bronze; platforms [databricks]) ·
delta-silver (data-lake, lake-layer, silver; platforms [databricks]) · delta-gold (data-lake, lake-layer, gold; platforms [databricks]) ·
raw-layer (data-lake, lake-layer, raw) · staging-layer (data-lake, lake-layer, staging) · curated-layer (data-lake, lake-layer, curated) ·
delta-lake (data-lake, lakehouse) · apache-iceberg (data-lake, lakehouse) · hdfs (storage, object-storage — legacy Hadoop)

## ontology/technologies/data_platforms.yaml
databricks (data-platforms, lakehouse) · snowflake (data-warehouse, warehouse) · bigquery (data-warehouse, warehouse) ·
amazon-redshift (data-warehouse, warehouse) · azure-synapse (data-warehouse, warehouse) ·
microsoft-fabric (data-platforms, lakehouse) · cloudera-hadoop (data-platforms, processing — legacy)

## ontology/technologies/processing.yaml
apache-spark (processing, processing) · google-dataproc (processing, processing) · amazon-emr (processing, processing) ·
spark-structured-streaming (streaming, stream-processing) · google-dataflow (processing, stream-processing) ·
apache-flink (streaming, stream-processing) · azure-stream-analytics (streaming, stream-processing) ·
dbt (processing, transformation) · lakeflow-declarative-pipelines (processing, transformation; platforms [databricks]) ·
dataform (processing, transformation; platforms [bigquery]) · databricks-sql (data-warehouse, serving; platforms [databricks])

## ontology/technologies/bi.yaml
tableau (bi, bi) · power-bi (bi, bi) · cognos (bi, bi) · microstrategy (bi, bi) · qlik (bi, bi) ·
looker (bi, bi) · amazon-quicksight (bi, bi) · business-objects (bi, bi)

## ontology/technologies/ai_ml.yaml
mlflow (ai-ml, ml) · vertex-ai (ai-ml, ml) · amazon-sagemaker (ai-ml, ml) · azure-machine-learning (ai-ml, ml) ·
databricks-model-serving (ai-ml, ml; platforms [databricks])

## ontology/technologies/governance_quality.yaml
unity-catalog (governance, governance; platforms [databricks]) · google-dataplex (governance, governance) ·
microsoft-purview (governance, governance) · aws-lake-formation (governance, governance) ·
aws-glue-data-catalog (governance, governance) · collibra (governance, governance) · alation (governance, governance) ·
snowflake-horizon (governance, governance; platforms [snowflake]) ·
reconciliation-framework (data-quality, data-quality) · great-expectations (data-quality, data-quality) ·
google-dvt (data-quality, data-quality) · lakehouse-monitoring (data-quality, data-quality; platforms [databricks])

## ontology/technologies/security.yaml
google-secret-manager (security, security) · aws-secrets-manager (security, security) · azure-key-vault (security, security) ·
hashicorp-vault (security, security) · google-iam (security, security) · aws-iam (security, security) ·
microsoft-entra-id (security, security) · google-cloud-kms (security, security) · aws-kms (security, security) ·
vpc-service-controls (security, security) · private-connectivity (security, security)

## ontology/technologies/observability.yaml
google-cloud-monitoring (observability, observability) · google-cloud-logging (observability, observability) ·
amazon-cloudwatch (observability, observability) · azure-monitor (observability, observability) ·
datadog (observability, observability) · prometheus (observability, observability) · grafana (observability, observability) ·
opentelemetry (observability, observability)

## ontology/technologies/devops.yaml
terraform (devops, devops) · github-actions (devops, devops) · azure-devops (devops, devops) · gitlab-ci (devops, devops) ·
jenkins (devops, devops) · google-cloud-build (devops, devops) · databricks-asset-bundles (devops, devops; platforms [databricks])

## ontology/technologies/containers_apis.yaml
docker (containers, container) · kubernetes (containers, container) · gke (containers, container) ·
amazon-eks (containers, container) · aks (containers, container) · apigee (apis, api) ·
amazon-api-gateway (apis, api) · azure-api-management (apis, api) · kong (apis, api)

## ontology/technologies/networking_cloud.yaml
gcp (cloud-platforms, cloud-platform) · aws (cloud-platforms, cloud-platform) · azure (cloud-platforms, cloud-platform) ·
google-cloud-interconnect (cloud-networking, network) · aws-direct-connect (cloud-networking, network) ·
azure-expressroute (cloud-networking, network) · site-to-site-vpn (cloud-networking, network) ·
google-vpc (cloud-networking, network) · aws-vpc (cloud-networking, network) · azure-vnet (cloud-networking, network)

## Risk ids (ontology/risks.yaml)
hidden-business-logic · skills-gap · data-volume-transfer · cutover-downtime · data-type-mismatch ·
sql-dialect-conversion · stored-procedure-rewrite · performance-regression · licensing-overlap ·
vendor-lock-in · cdc-lag · schema-drift · data-quality-regression · security-gap · lineage-loss ·
scheduling-dependency-loss · report-parity · mainframe-encoding · cost-overrun · parallel-run-cost ·
integration-breakage · governance-gap · regulatory-compliance · network-bandwidth · operational-readiness

## Strategy ids (ontology/strategies.yaml)
retain · retire · rehost · relocate · repurchase · replatform · refactor · rearchitect

## ontology/technologies/reliability.yaml (role `resilience`)
cross-region-dr (reliability, resilience) · backup-recovery (reliability, resilience) ·
retry-dead-letter (reliability, resilience)
