---
vendor: Google Cloud
product: BigQuery Migration Service
title: BigQuery Migration Service and Teradata-to-BigQuery migration
url: https://cloud.google.com/bigquery/docs/migration-intro
doc_type: curated-note
technologies: [bigquery, teradata, google-dvt, gcp, netezza, oracle-database]
version: null
---

## What it is

BigQuery Migration Service is a set of Google Cloud tools for moving data warehouses to BigQuery. It covers assessment, SQL translation, data transfer and validation. Teradata is one of the most fully documented source paths, with guides also available for sources such as Oracle, Netezza, Redshift and Snowflake (coverage evolves; check current documentation).

## Key capabilities

- **Migration assessment**: analyses metadata and query logs extracted from the source (via a provided extraction tool) to estimate complexity, identify heavily used objects and produce reports in BigQuery/Looker Studio.
- **SQL translation**: *batch* translation of files of DDL, queries and scripts (including BTEQ for Teradata), an *interactive* translator in the console, and a translation API. Output includes warnings for constructs that cannot be translated automatically.
- **Data transfer**: the BigQuery Data Transfer Service supports Teradata via an on-premises migration agent that extracts data (using Teradata utilities such as TPT or JDBC) to Cloud Storage and loads it into BigQuery, with options for one-time or incremental loads.
- **Validation**: the open-source Data Validation Tool (DVT) compares row counts, column aggregates and row hashes between source and BigQuery.

## Teradata-specific considerations

- **Distribution and indexing**: Teradata primary indexes and partitioned primary indexes have no direct equivalent; redesign using BigQuery partitioning (by date/timestamp or integer range) and clustering.
- **SET tables and duplicates**: Teradata SET tables silently reject duplicate rows; BigQuery has no equivalent, so deduplicate explicitly.
- **Case sensitivity and collation**: Teradata columns are often `NOT CASESPECIFIC`; BigQuery string comparison is case-sensitive by default unless collation is specified.
- **Procedural code**: BTEQ control flow (`.IF ERRORCODE`, `.GOTO`), macros and stored procedures must become BigQuery scripting/procedures, Dataform/dbt models or orchestration logic.
- **Utilities**: FastLoad/MultiLoad/TPT jobs are replaced by load jobs, the Storage Write API or Dataflow.

## Common pitfalls

- Treating translated SQL as finished; semantic differences (NULL ordering, integer division, timestamp precision, implicit casts) still need testing.
- Ignoring BigQuery cost model differences (on-demand bytes scanned vs capacity/editions) when sizing.
- Migrating unused objects; use assessment query logs to retire them.
- Skipping row-level validation for financial tables.
