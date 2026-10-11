---
vendor: Databricks
product: Delta Lake
title: Delta Lake — ACID table format for the lakehouse
url: https://docs.databricks.com/aws/en/delta/
doc_type: curated-note
technologies: [delta-lake, databricks, apache-spark, apache-iceberg]
version: null
---

## What it is

Delta Lake is an open-source table format (a Linux Foundation project, originally created by Databricks) that adds a transaction log on top of Parquet files in object storage. It is the default table format on Databricks and is readable and writable by Spark and a growing set of other engines.

## Key capabilities

- **ACID transactions** via the `_delta_log` directory of ordered JSON commits and periodic checkpoints; concurrent writers use optimistic concurrency control.
- **Schema enforcement and evolution**: writes with mismatched schemas are rejected unless evolution is explicitly enabled (for example `mergeSchema`).
- **DML**: `UPDATE`, `DELETE` and `MERGE INTO`, enabling CDC application and SCD patterns directly on lake tables.
- **Time travel**: query earlier versions by version number or timestamp, subject to log and file retention.
- **Layout optimisation**: `OPTIMIZE` file compaction, Z-ordering, and the newer *liquid clustering*, which Databricks generally recommends over partitioning plus Z-order for new tables; deletion vectors speed up updates and deletes.
- **Change Data Feed**: optional row-level change output for downstream incremental processing.
- **Interoperability**: UniForm can expose Iceberg-compatible metadata so Iceberg readers can access Delta tables; capabilities evolve, so check current documentation.

## Migration-relevant considerations

- **Partitioning**: legacy Hive-style designs often over-partition. Prefer liquid clustering or coarse partitions (for example by date for very large tables) to avoid small files.
- **Data types**: map source DECIMAL precision/scale, timestamps and time zones carefully; Delta/Spark `TIMESTAMP` is session-time-zone aware while `TIMESTAMP_NTZ` is not.
- **Protocol versions and table features**: enabling newer features (deletion vectors, column mapping, liquid clustering) can raise the reader/writer protocol, which may lock out older external readers. Check compatibility before enabling on shared tables.
- **Converting existing Parquet**: `CONVERT TO DELTA` converts in place; cloning (`DEEP CLONE`/`SHALLOW CLONE`) is useful for migration testing.

## Common pitfalls

- Running `VACUUM` with a short retention, which breaks time travel and can corrupt long-running readers; the default retention threshold is 7 days.
- Writing to Delta paths with non-Delta tools, bypassing the log.
- Never running maintenance (`OPTIMIZE`, `VACUUM`) on high-churn tables — or enable predictive optimization where available.
- Many small streaming commits without compaction, degrading read performance.
