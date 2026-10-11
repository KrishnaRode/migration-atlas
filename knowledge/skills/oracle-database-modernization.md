---
id: oracle-database-modernization
title: Oracle database modernization (PL/SQL, data types, CDC, OLTP vs analytics)
triggers:
  technologies: [oracle-database, oracle-exadata, oracle-goldengate, postgresql, amazon-aurora, alloydb, cloud-sql, azure-sql-database, aws-dms, azure-dms, google-datastream, debezium]
  roles: [source-database]
  keywords: [oracle, pl/sql, plsql, exadata, rac, ora2pg, schema conversion, sequences, packages, oracle license]
priority: 6
---

## First question: OLTP or analytics?
Oracle estates mix both. Split them before choosing anything.
- **OLTP** (application backing store): targets are managed relational engines — PostgreSQL-family (Aurora PostgreSQL, AlloyDB, Cloud SQL, Azure Database for PostgreSQL), or Oracle on a managed service (Amazon RDS for Oracle, Oracle Database@AWS/Azure/Google Cloud — verify current offerings) when the app cannot change.
- **Analytics / reporting** schemas: move to a warehouse or lakehouse; replicate OLTP into it via CDC rather than migrating the app.
- A shared schema serving both is a red flag; decouple with CDC first.

## Rehost vs replatform vs refactor
- **Keep Oracle** (rehost to cloud, managed Oracle) when: heavy PL/SQL (>100k lines), vendor packaged app certified only on Oracle, RAC-dependent availability, or deadline under ~6 months.
- **Move to PostgreSQL** when licence exit is the driver and the app team can own code changes. Budget most effort for PL/SQL, not data.
- Licensing on cloud differs from on-prem (vCPU counting rules, BYOL vs licence-included). Verify current Oracle cloud licensing policy before any cost case.

## Conversion reality
- Tools: AWS Schema Conversion Tool, ora2pg, Google Database Migration Service conversion workspaces, partner tools. They convert DDL and simple procedures well; packages, autonomous transactions, `CONNECT BY`, `DBMS_*` packages, global temporary tables, `ROWNUM` pagination, implicit type conversions and `MERGE` nuances need manual work.
- Data type traps: `NUMBER` without precision (map deliberately — `numeric` is slow, `bigint` may truncate), `DATE` includes time in Oracle, empty string equals NULL in Oracle but not PostgreSQL, `CLOB/BLOB` sizes, `TIMESTAMP WITH LOCAL TIME ZONE`.
- Sequences, triggers and synonyms change behaviour; application ORM settings must follow.
- Application SQL embedded in Java/.NET code is usually the hidden majority — scan the codebase, not just the database.

## CDC options for low downtime
- **Oracle GoldenGate**: most mature, handles high volume and complex types; licensed separately.
- **AWS DMS / Azure DMS / Google Datastream / Debezium / Qlik Replicate / Striim**: LogMiner- or binary-log-reader based; check supported Oracle versions, LOB handling, and redo throughput limits.
- Supplemental logging must be enabled; confirm with the DBA team early (change-control lead time).
- See cdc-and-low-downtime-cutover for cutover mechanics.

## What to ask
- Database count, size, redo generation per hour at peak.
- PL/SQL line count and number of packages; who owns them.
- Packaged app or custom app? Vendor support matrix?
- RPO/RTO and acceptable cutover window.
- Features in use: RAC, Data Guard, partitioning, Advanced Queuing, Spatial, Label Security.

## Validation
Row counts and checksums per table, sequence high-water marks, constraint and index parity, and application regression tests with production-like data. Performance-test the top 50 SQL statements by elapsed time from AWR — plan regressions are the most common go-live surprise.

## Red flags
- "Tool converts 95% automatically" quoted from object counts, not from line-weighted complexity.
- No performance baseline from AWR/ASH.
- Cutover plan with no rollback path (reverse replication or retained source).
- Licence savings counted before the PL/SQL rewrite is costed.
