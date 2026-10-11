---
id: etl-modernization
title: ETL modernization (Informatica, DataStage, SSIS, Ab Initio, Talend → modern ELT)
triggers:
  technologies: [informatica-powercenter, informatica-idmc, ibm-datastage, ssis, ab-initio, talend, pentaho, dbt, dataform, lakeflow-declarative-pipelines, google-dataflow, azure-data-factory, aws-glue, google-cloud-data-fusion, apache-spark]
  roles: [etl, transformation, processing]
  keywords: [etl, elt, informatica, datastage, ssis, ab initio, talend, mapping, code conversion, dbt, pipeline rewrite, transformation]
priority: 6
---

## ETL vs ELT
- **ELT** (land raw, transform in the warehouse/lakehouse with SQL — dbt, Dataform, Lakeflow Declarative Pipelines, Snowflake/BigQuery SQL) is the default for analytics: transformations are versioned SQL, testable, and scale with the engine.
- **Keep ETL-style engines** (Spark, Dataflow, Glue, ADF data flows) for heavy non-SQL logic, unstructured/semi-structured parsing, streaming, or when data must be masked/filtered before it lands (residency, PII minimisation).
- ADF and Glue are often orchestration + ingestion; avoid putting complex business logic in visual data flows if the team wants code review and testing.

## Target heuristics
- Databricks target → Lakeflow Declarative Pipelines or dbt on Databricks SQL; notebooks/jobs for complex Python.
- BigQuery → Dataform or dbt; Dataflow for streaming/complex transforms.
- Snowflake → dbt (or Snowflake-native tasks/dynamic tables for simpler cases).
- Azure / Fabric → ADF/Fabric pipelines for ingestion + dbt or Spark notebooks for transforms.
- Team skill matters more than tool fashion: SQL-heavy teams succeed with dbt; Python/Spark teams with notebooks/pipelines.

## Code conversion: the honest picture
- Automated converters (vendor accelerators, partner tools, LLM-assisted conversion) can parse Informatica XML, DataStage DSX, SSIS DTSX and produce SQL/PySpark. They handle standard patterns (lookups, joins, filters, aggregations, SCD2 templates) well.
- They struggle with: custom Java/C transformations, Ab Initio graphs with PDL/component parameters, stored-procedure calls, session-level overrides, parameter files, reusable mapplets with implicit behaviour, row-by-row stateful logic, error-handling and restart semantics.
- Realistic outcome: a converter accelerates 40–70% of jobs to a "compiles and runs" state; every job still needs testing and many need refactoring to be idiomatic set-based SQL. Treat vendor "95% automation" claims as object-count metrics until proven on your code.
- Do **not** blindly translate 1:1. Many legacy jobs exist to stage, sort or work around old engine limits; consolidate them.

## Sequencing
1. Inventory from repository metadata (not interviews): jobs, mappings, sources/targets, schedules, run history. Retire jobs with no runs in 6–12 months (often 15–30%).
2. Classify by complexity (simple/medium/complex) and by pattern (ingest, SCD, aggregate, extract).
3. Build reusable templates for the top patterns (ingestion, SCD2, snapshot, file extract).
4. Convert by **data domain**, end-to-end, so you can reconcile outputs and cut over consumers together.
5. Run old and new in parallel; compare outputs table by table.

## What to ask
Job count by tool, run frequency, run-time SLAs, custom code usage, parameter-file sprawl, restart/recovery requirements, licence renewal date, and who maintains the jobs today.

## Validation
Output-level reconciliation per target table (counts, aggregates, key-level hashes) on identical input snapshots; include error/reject-path testing and late-arriving data scenarios.

## Red flags
- Converting without lineage — no idea which jobs feed which reports.
- Licence renewal before the plan has a realistic cutover date.
- Treating ADF/Glue as a drop-in for Informatica without designing restartability and logging.
- No owner for data quality rules previously hidden inside mappings.
