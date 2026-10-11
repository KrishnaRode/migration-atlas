---
vendor: Databricks
product: Medallion architecture
title: Medallion architecture — bronze, silver and gold layers
url: https://docs.databricks.com/aws/en/lakehouse/medallion
doc_type: curated-note
technologies: [delta-bronze, delta-silver, delta-gold, delta-lake, databricks, landing-zone, raw-layer, curated-layer]
version: null
---

## What it is

The medallion architecture is a data design pattern that organises a lakehouse into progressively refined layers. It is a convention, not a product feature: names and the number of layers can vary, but the intent is that data quality and business meaning increase as data moves through the layers.

## The layers

- **Landing (optional)**: raw files exactly as delivered by source systems or CDC tools, often outside the table format. Useful for replay and audit.
- **Bronze**: data ingested into tables with minimal transformation — source structure preserved, plus ingestion metadata (load timestamp, source file, batch id). Append-oriented; the replayable system of record for the lake.
- **Silver**: cleansed, conformed and de-duplicated data. Types are enforced, keys are resolved, CDC is applied (current state and/or history), and reference data is joined. Silver is often the enterprise "single version" of entities.
- **Gold**: consumption-ready data shaped for specific use cases — dimensional models, aggregates, feature tables, data products — optimised for BI and ML access.

## Migration-relevant considerations

- **Mapping legacy zones**: legacy warehouses typically have staging, ODS/integration and mart layers. A pragmatic mapping is staging → bronze, ODS/3NF integration → silver, marts/semantic layer → gold. Document this mapping explicitly so reconciliation can be done layer by layer.
- **Where business logic lands**: logic hidden in ETL tools and stored procedures should be placed deliberately — technical cleansing in silver, business rules and KPIs in gold — rather than replicated wherever it happened to live before.
- **Governance**: in Unity Catalog, a common approach is catalogs per environment with schemas per layer or domain; alternatively catalogs per layer. Choose one and apply it consistently.
- **Reprocessing**: keeping bronze immutable makes it possible to rebuild silver and gold after logic fixes, which is valuable during parallel runs.

## Common pitfalls

- Treating layers as mandatory copies of every table, inflating storage and pipeline count without adding value.
- Allowing BI tools to query bronze directly, bypassing quality controls.
- Putting heavy business logic into bronze ingestion, which removes the ability to replay raw data.
- No data-quality gates between layers; use expectations or tests (for example Lakeflow Declarative Pipelines expectations, dbt tests, Great Expectations) to enforce contracts.
- Inconsistent naming across teams, which makes lineage and discovery harder.
