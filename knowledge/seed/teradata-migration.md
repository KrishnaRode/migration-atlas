---
vendor: Teradata
product: Teradata Vantage
title: Teradata migration — BTEQ, utilities and SQL dialect
url: https://docs.teradata.com/
doc_type: curated-note
technologies: [teradata, bigquery, snowflake, databricks, databricks-sql, amazon-redshift, microsoft-fabric]
version: null
---

## Context

Teradata is a shared-nothing MPP data warehouse. Rows are distributed across AMPs (access module processors) by hashing the **primary index**; workloads are governed by TASM workload management. Large Teradata estates usually contain decades of SQL, BTEQ scripts, macros, stored procedures and load utilities, plus BI and ETL tools that push SQL down to Teradata.

## Code assets to inventory

- **BTEQ scripts**: SQL mixed with dot-commands for control flow and I/O — `.IF ERRORCODE <> 0 THEN .GOTO`, `.LABEL`, `.QUIT`, `.EXPORT`/`.IMPORT`, `.SET` options. Control flow must move into orchestration or procedural SQL on the target.
- **Load/unload utilities**: FastLoad, MultiLoad, FastExport, TPump and Teradata Parallel Transporter (TPT) scripts are replaced by target-native bulk loading (COPY, load jobs, Auto Loader) or ETL tools.
- **Macros, stored procedures (SPL), UDFs** and **views layered many levels deep**, which often embed business logic.
- **Statistics, join indexes, secondary indexes** — tuning artefacts that usually do not migrate but hint at performance-critical queries.

## SQL dialect differences to test

- `QUALIFY` is supported on BigQuery, Snowflake and Databricks, but other Teradata shorthand (`SEL`, `INS`, `DEL`), `TOP n WITH TIES`, `SAMPLE`, `NORMALIZE`, period data types and `RESET WHEN` need translation.
- **Case sensitivity**: columns defined `NOT CASESPECIFIC` (common in Teradata session mode) compare case-insensitively; most targets are case-sensitive by default.
- **SET vs MULTISET tables**: SET tables reject duplicate rows; targets do not, so duplicates may appear after migration.
- **Date and number handling**: integer-date arithmetic, `FORMAT` phrases on columns, implicit casts between strings and numbers, `DECIMAL` rounding and division behaviour.
- **Volatile and global temporary tables** map to temporary tables, CTEs or session-scoped objects.
- **Transaction modes**: Teradata (BT/ET) vs ANSI mode change commit and error semantics.

## Migration-relevant considerations

- Use query logs (DBQL) to identify actually-used objects, heavy queries and concurrency peaks.
- Translators (BigQuery Migration Service, Snowflake SnowConvert, Databricks partner converters, AWS SCT) handle much syntax; semantic validation still requires data comparison.
- Plan data extraction throughput (TPT export, parallel sessions) and network bandwidth; historical volumes can be tens to hundreds of TB.

## Common pitfalls

- Translating primary-index design into partitioning without workload analysis.
- Losing implicit deduplication from SET tables.
- Overlooking BI tools' generated SQL that relied on Teradata functions.
- Underestimating concurrency: Teradata workload management often hid contention that appears on the new platform.
