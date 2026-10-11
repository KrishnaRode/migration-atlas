---
vendor: dbt Labs
product: dbt
title: dbt — SQL-first transformation with software engineering practices
url: https://docs.getdbt.com/docs/introduction
doc_type: curated-note
technologies: [dbt, snowflake, bigquery, databricks, amazon-redshift, microsoft-fabric]
version: null
---

## What it is

dbt is a transformation framework in which analysts and engineers write `SELECT` statements as *models*, and dbt compiles them (with Jinja templating) into DDL/DML that runs inside the target data platform. It handles dependency ordering, testing, documentation and deployment conventions, but it does not extract or load data itself (the "T" in ELT). dbt is available as open-source dbt Core and as the commercial managed dbt platform (formerly dbt Cloud); dbt Labs has also introduced a new engine (Fusion) — check current documentation for editions and features.

## Key capabilities

- **Models and materialisations**: view, table, incremental (with strategies such as append, merge, delete+insert, insert_overwrite, microbatch depending on adapter), ephemeral, and materialized views on supported platforms.
- **Dependency graph** via `ref()` and `source()`, enabling selective builds (`dbt build --select ...`) and lineage.
- **Testing**: generic data tests (unique, not_null, accepted_values, relationships), custom SQL tests, unit tests for model logic, and model contracts that enforce column types.
- **Snapshots** for SCD Type 2 history on mutable source tables.
- **Packages and macros** for reuse (for example `dbt_utils`), and auto-generated documentation.
- **Adapters** for Snowflake, BigQuery, Databricks, Redshift, Postgres, Fabric/Synapse, Spark, Trino and others.

## Migration-relevant considerations

- **Stored procedure decomposition**: legacy procedures and ETL mappings often mix multiple steps; decompose them into layered models (staging → intermediate → marts) so each step is testable.
- **Dialect and macros**: cross-database macros help portability, but most real projects contain platform-specific SQL. Translate once to the target dialect rather than aiming for full portability.
- **Incremental logic** must be explicit: unique keys, late-arriving data and deletes need careful handling.
- **Orchestration**: dbt runs from the dbt platform scheduler, Airflow/Composer, Databricks jobs (dbt task), or CI pipelines; pick one owner for production runs.
- **Reconciliation**: dbt tests and audit packages (such as comparison macros) are useful for parallel-run checks.

## Common pitfalls

- Re-implementing procedural, row-by-row logic with Jinja loops instead of set-based SQL.
- Full-refresh rebuilds of very large incremental models by accident.
- Weak naming and folder conventions, producing an unmanageable DAG.
- Tests defined but never run in CI or production.
