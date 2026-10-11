---
vendor: Databricks
product: Lakeflow Declarative Pipelines
title: Lakeflow Declarative Pipelines (formerly Delta Live Tables)
url: https://docs.databricks.com/aws/en/dlt/
doc_type: curated-note
technologies: [lakeflow-declarative-pipelines, databricks, delta-lake, unity-catalog]
version: null
---

## What it is

Lakeflow Declarative Pipelines (LDP), formerly Delta Live Tables (DLT), is a declarative framework for building batch and streaming pipelines in SQL or Python. You declare the datasets you want; the engine works out dependencies, orchestration, retries, infrastructure and incremental processing. Databricks has contributed the core declarative model to Apache Spark, and product naming continues to evolve — check current documentation.

## Key capabilities

- **Dataset types**: *streaming tables* (append/incremental processing of sources such as Auto Loader or Kafka), *materialized views* (results kept up to date, with incremental refresh where possible), and temporary views.
- **Flows**: multiple flows can write into one streaming table (for example combining several sources or backfilling).
- **CDC**: the `AUTO CDC` (previously `APPLY CHANGES INTO`) API applies ordered change events with SCD Type 1 or Type 2 semantics, handling out-of-order events by a sequencing column.
- **Data quality**: *expectations* declare constraints and choose to warn, drop invalid rows, or fail the update; metrics are captured in the pipeline event log.
- **Execution modes**: triggered (run and stop) or continuous; serverless or classic compute; development vs production modes.

## Migration-relevant considerations

- **Good fit** for re-implementing staged ETL (staging → integration → marts) as bronze/silver/gold datasets with built-in lineage and quality rules, and for CDC application from replication tools.
- **Translating legacy ETL**: Informatica mappings or stored procedures that perform procedural row-by-row logic need refactoring into set-based SQL/DataFrame transformations; LDP is not a procedural engine.
- **Orchestration**: pipelines are usually invoked as a task in a Databricks job so they can participate in wider dependencies.
- **Governance**: pipelines publish to Unity Catalog; plan the target catalog/schema and who owns pipeline-created tables.

## Common pitfalls

- Trying to perform arbitrary side effects (writing files, calling APIs, ad-hoc DML) inside dataset definitions; the framework expects pure transformations.
- Expecting materialized views to always refresh incrementally — some query shapes fall back to full recomputation.
- Full refreshes of streaming tables that read from sources with limited retention (for example Kafka), which can lose history.
- Not monitoring the event log for expectation failures and data-quality drift.
