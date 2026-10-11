---
vendor: IBM
product: IBM Netezza Performance Server
title: Netezza migration considerations
url: https://www.ibm.com/docs/en/netezza
doc_type: curated-note
technologies: [netezza, ibm-datastage, snowflake, bigquery, databricks, amazon-redshift, azure-synapse]
version: null
---

## Context

Netezza (originally an appliance: TwinFin, Striper, Mako generations) is a PostgreSQL-derived MPP warehouse that uses FPGA-accelerated scanning and a shared-nothing design. IBM ended support for the older appliance models and continues the product as IBM Netezza Performance Server, available on Cloud Pak for Data System and as a managed cloud service; check IBM documentation for current offerings and support dates. Many customers use appliance end-of-support as the trigger to migrate to Snowflake, BigQuery, Databricks, Redshift or Azure.

## Netezza concepts that affect migration

- **Distribution**: `DISTRIBUTE ON (columns)` or `RANDOM` controls data placement across data slices; co-located joins depend on matching distribution keys.
- **Zone maps and `ORGANIZE ON`** (clustered base tables) provide pruning instead of indexes; there are no traditional indexes.
- **Groom** reclaims space from deleted rows (Netezza uses MVCC-like logical deletes); missing grooms inflate storage.
- **NZPLSQL** stored procedures (PL/pgSQL-like), user-defined functions and aggregates (often C++), and analytic packages (INZA).
- **Utilities**: `nzsql`, `nzload`, external tables for high-speed load/unload, and `nz_migrate` for copying between Netezza systems.
- **Cross-database queries** within a single Netezza system (`database..table` notation) are common and must be mapped to target catalog/schema structures.

## Migration-relevant considerations

- **Extraction**: external tables (`CREATE EXTERNAL TABLE ... USING`) unloading to delimited or compressed files are typically the fastest extract path; plan parallelism and staging storage.
- **SQL translation**: syntax is closer to PostgreSQL than Teradata, but functions, date handling, `NOW()` semantics, implicit casts and NZPLSQL need conversion. Use automated translators and verify results.
- **ETL coupling**: Netezza estates often pair with DataStage or Informatica using pushdown (ELT) — the logic may live in generated SQL rather than in the ETL tool.
- **UDXs**: C++ user-defined functions have no direct equivalent and must be rewritten (SQL, Python/Java UDFs, or external services).

## Common pitfalls

- Assuming PostgreSQL compatibility means minimal change.
- Performance expectations based on FPGA full scans; the target may need clustering/partitioning design for similar response times.
- Ignoring precision of NUMERIC and timestamp types during file-based unload and reload (formatting, delimiters, NULL representation).
- Forgetting to inventory cross-database references and synonyms.
