---
vendor: Oracle
product: Oracle Database
title: Oracle-to-cloud migration considerations — PL/SQL, data types and semantics
url: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Data-Types.html
doc_type: curated-note
technologies: [oracle-database, oracle-exadata, postgresql, alloydb, amazon-aurora, bigquery, snowflake, databricks]
version: null
---

## Scope

Moving Oracle workloads to cloud targets — PostgreSQL-compatible databases (Cloud SQL, AlloyDB, Aurora, Azure Database for PostgreSQL), cloud warehouses (BigQuery, Snowflake, Redshift) or lakehouses (Databricks) — is rarely a pure data copy. The hard parts are semantics, procedural code and performance assumptions. Oracle also offers rehost-style options (Oracle Database@AWS/Azure/Google Cloud, OCI) that keep the engine unchanged.

## Data type and semantic differences

- **NUMBER** without precision/scale can hold up to 38 digits with variable scale; targets may need `NUMERIC`, `DECIMAL(38, s)` or `DOUBLE` — profile actual values to choose.
- **DATE** includes a time component to the second; mapping it to a date-only type silently truncates.
- **Empty string equals NULL** in Oracle; most targets distinguish them, which changes predicates, concatenation and uniqueness.
- **VARCHAR2** length semantics may be BYTE or CHAR; multibyte character sets change effective lengths.
- **TIMESTAMP WITH (LOCAL) TIME ZONE**, **INTERVAL**, **RAW**, **CLOB/BLOB**, **XMLType** and spatial types need explicit mapping decisions.
- **Sorting and comparison**: NLS settings (NLS_SORT, NLS_COMP), NULL ordering defaults and implicit conversions differ.

## Procedural and SQL constructs

- **PL/SQL packages** (with package state), autonomous transactions, `BULK COLLECT`/`FORALL`, collections, `DBMS_*` packages, `UTL_FILE`, scheduler jobs and database links have no direct equivalent in many targets.
- **SQL syntax**: `(+)` outer joins, `CONNECT BY` hierarchical queries, `ROWNUM`, `DECODE`, `NVL`, sequences, synonyms, `MERGE` nuances, optimizer hints.
- **Triggers** used for auditing or business rules must be re-implemented or moved into application/pipeline logic.

## Tools

AWS Schema Conversion Tool / DMS Schema Conversion, Google Database Migration Service conversion workspaces (Oracle to PostgreSQL/AlloyDB), the open-source Ora2Pg, and SQL translators for warehouses (BigQuery translation, Snowflake SnowConvert, Databricks partner tools). Treat automated conversion rates as a starting estimate; check current documentation for each tool's coverage.

## Common pitfalls

- Sizing targets from Exadata hardware rather than measured workload (AWR reports), or assuming Exadata smart-scan performance on generic infrastructure.
- Missing licensing and support timelines in the business case.
- Underestimating application-tier changes (JDBC drivers, connection pooling, ORM dialects).
- Insufficient regression testing of numeric rounding and NULL behaviour.
