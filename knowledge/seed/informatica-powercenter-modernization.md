---
vendor: Informatica
product: Informatica PowerCenter
title: Informatica PowerCenter modernization
url: https://docs.informatica.com/data-integration/powercenter.html
doc_type: curated-note
technologies: [informatica-powercenter, informatica-idmc, databricks, dbt, aws-glue, azure-data-factory]
version: null
---

## What it is

Informatica PowerCenter is a long-established on-premises ETL platform. Development objects are stored in a repository: *sources* and *targets*, *mappings* (data flow built from transformations), *mapplets* (reusable logic), *sessions* (runtime configuration of a mapping), and *workflows/worklets* (orchestration with links, conditions, timers and command tasks). Parameter files supply connection and runtime values.

## Modernisation paths

- **Informatica-to-Informatica**: move to Informatica Intelligent Data Management Cloud (IDMC), using Informatica's PowerCenter-to-cloud modernisation services and tooling. This minimises re-skilling but retains vendor licensing. Check current Informatica documentation for support timelines of PowerCenter versions.
- **Re-platform to cloud-native ELT**: convert mappings to Spark/PySpark or SQL on Databricks, dbt models on a warehouse, AWS Glue, or Azure Data Factory/Fabric. Automated converters (vendor and partner accelerators) parse exported repository XML and generate code; output quality varies widely.
- **Hybrid**: keep PowerCenter for a period while new pipelines are built natively, then retire by domain.

## Assessment approach

- Export repository metadata (XML) and inventory mappings, sessions, workflows, transformations used, connections, and run history.
- Classify complexity by transformation types: Expression/Filter/Aggregator/Joiner are straightforward; Java/Custom transformations, stored procedure calls, dynamic lookups, Update Strategy logic, Normalizer, and SQL overrides are harder.
- Identify dead objects (never run in the last N months) to retire rather than migrate.
- Capture embedded business rules in expressions and SQL overrides — often the primary *hidden business logic* risk.

## Migration-relevant considerations

- **Row-by-row semantics**: PowerCenter variable ports, sequence generators and lookup caches can encode order-dependent behaviour that set-based SQL does not reproduce without care.
- **Pushdown optimisation** settings may mean logic actually executes in the database; read the effective SQL.
- **Scheduling**: workflows are often triggered by external schedulers (Control-M) via `pmcmd`; that integration must be replaced.
- **Testing**: build automated comparison of target tables produced by old and new pipelines for identical inputs.

## Common pitfalls

- Line-by-line translation that preserves inefficient staging patterns instead of redesigning for the lakehouse/warehouse.
- Ignoring session-level settings (commit intervals, error thresholds, treat-source-rows-as) that affect results.
- Underestimating parameter-file and connection sprawl.
