---
id: warehouse-migration
title: Warehouse migration (Teradata, Netezza, Exadata, Greenplum → cloud)
triggers:
  technologies: [teradata, netezza, oracle-exadata, greenplum, sybase-ase, bigquery, snowflake, databricks, databricks-sql, amazon-redshift, azure-synapse, microsoft-fabric]
  roles: [legacy-warehouse, warehouse]
  keywords: [warehouse, edw, bteq, mpp, data mart, sql conversion, teradata, netezza, exadata, appliance, fastload, tpt, nzsql]
priority: 5
---

## Frame the problem first
A legacy EDW migration is three migrations at once: **data** (history + incremental), **code** (DDL, views, stored procedures, BTEQ/nzsql scripts, macros), and **consumers** (ETL feeds, BI, extracts, downstream apps). Data is the easy part. Code and consumers drive 70–80% of effort and almost all schedule risk.

## What to ask before designing
- Total compressed vs uncompressed size, largest tables, daily change volume.
- Object counts: tables, views, procedures/macros, scripts, ETL jobs, reports.
- Peak concurrency and the 10 most critical SLAs (e.g., "finance close by 06:00").
- Who loads it (Informatica, DataStage, BTEQ, TPT, custom) and who reads it (BI tools, extracts, APIs).
- Contract end date of the appliance — this sets the real deadline.
- Regulatory or residency constraints on where data may land.

## Decision heuristics
- **Lift-and-shift SQL first, re-model later.** Converting 3NF/dimensional models to a new paradigm during migration doubles risk. Migrate like-for-like, prove parity, then optimise.
- Target choice depends on workload and skills, not on the source (see platform-selection). All major targets handle EDW-scale SQL.
- Prefer automated SQL translation (vendor translators, SQLGlot-based tooling, partner accelerators) for the bulk; expect **manual work on procedural code**, recursive SQL, QUALIFY/period types (some targets support QUALIFY; verify), volatile/global temp tables, SET-table dedupe semantics, and case-sensitivity/collation differences.
- Teradata specifics: PI/PPI do not map to anything; replace with clustering/partitioning chosen from actual query predicates. BTEQ control flow (`.IF ERRORCODE`) must become orchestrator logic.
- Netezza: distribution keys and zone maps disappear; nzsql scripts and stored procedures (NZPLSQL) need conversion.
- Exadata: often hides heavy PL/SQL; treat as an Oracle modernization (see oracle-database-modernization).

## Sequencing
1. Inventory and dependency graph (query logs are gold — Teradata DBQL, Netezza history DB).
2. Pick a pilot domain with real consumers but contained dependencies.
3. Historical bulk load (export to object storage in Parquet/compressed CSV; use offline transfer devices only when network math says weeks).
4. Incremental sync (CDC or re-pointed ETL dual-writing) while consumers move.
5. Parallel run with reconciliation, then cut consumers over domain by domain.
6. Decommission only after a full business cycle (month-end, quarter-end) passes on target.

## Sizing and cost signals
- Network: 100 TB over 1 Gbps ≈ 9–10 days at full utilisation; plan for 50–70% effective.
- Expect query patterns to change cost behaviour: scan-priced engines punish `SELECT *` and unpartitioned filters; credit/DBU engines punish idle warehouses left running.
- Workload management (TASM-style priorities) must be redesigned as separate compute pools/warehouses per workload class.

## Validation
Row counts per table/partition, column-level aggregates (sum, min, max, null counts, distinct counts), hash-based row comparison on keys for critical tables, and report-level parity for top dashboards. See reconciliation-and-testing.

## Red flags
- "We will rewrite everything into a new model during migration."
- No query-log analysis; inventory built from interviews only.
- Unknown extract consumers (SFTP files to partners) discovered after cutover.
- Appliance contract ends in under 9 months with >5,000 procedural objects.
- Decimal precision, timestamp time-zone and trailing-space semantics not tested.
