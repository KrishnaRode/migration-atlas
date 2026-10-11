---
vendor: Salesforce
product: Tableau
title: Repointing Tableau to cloud data warehouses
url: https://help.tableau.com/current/pro/desktop/en-us/connect_basic_replace.htm
doc_type: curated-note
technologies: [tableau, snowflake, bigquery, databricks-sql, amazon-redshift, azure-synapse, teradata, oracle-database]
version: null
---

## Context

When the warehouse behind Tableau moves (for example Teradata or Oracle to Snowflake, BigQuery, Databricks SQL or Redshift), every workbook and published data source that connects to it must be repointed and validated. Tableau supports replacing a data source in a workbook and editing connections on published content, but differences in schema names, column names, data types and SQL dialect determine how smooth this is.

## Inventory first

- Use Tableau Server/Cloud metadata (the Metadata API / Catalog where licensed, or the repository and REST API) to list workbooks, published data sources, connection types, server names, custom SQL and extract schedules.
- Separate **published data sources** (repoint once, many workbooks benefit) from **embedded connections** in individual workbooks (repoint each).
- Identify **custom SQL**, **initial SQL**, **RAWSQL_*** pass-through functions and database-specific calculated fields; these contain source dialect and must be rewritten.
- Flag usage: retire unused workbooks rather than migrating them.

## Repointing approaches

- **Replace data source** in Tableau Desktop: connect to the new source, then use *Replace Data Source*; fields match by name, so preserving column names (and case) in the target simplifies the switch. Mismatched fields appear with warnings and must be remapped.
- **Edit connection** on published data sources via Tableau Server/Cloud or the REST API when only server, database or credentials change.
- **Programmatic** updates with the Tableau Document API or REST API for bulk changes, followed by validation.
- **Extracts vs live**: decide per data source; moving to a cloud warehouse often enables live connections, but cost (bytes scanned / warehouse uptime) and concurrency must be considered.

## Validation

- Compare key dashboard numbers between old and new sources for the same filters and dates (screenshots or exported crosstabs, automated where possible).
- Watch for differences in case-sensitive filtering, NULL handling, date truncation and time zones, numeric precision and sort order.
- Performance-test heavy dashboards under realistic concurrency.

## Common pitfalls

- Renaming columns or changing case in the target, breaking field matching.
- Forgetting authentication changes (OAuth, key-pair, service accounts) and embedded credentials for scheduled extracts.
- Ignoring Tableau Prep flows and data-driven alerts that also point at the legacy source.
