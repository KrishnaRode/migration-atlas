---
vendor: Google Cloud
product: Datastream
title: Datastream — serverless change data capture on Google Cloud
url: https://cloud.google.com/datastream/docs/overview
doc_type: curated-note
technologies: [google-datastream, gcp, bigquery, google-cloud-storage, oracle-database, mysql, postgresql, sql-server]
version: null
---

## What it is

Datastream is Google Cloud's serverless change data capture (CDC) and replication service. It reads changes from operational databases and delivers them with low latency to BigQuery or Cloud Storage, from where Dataflow, Dataproc, Spark or Databricks can process them.

## Key capabilities

- **Sources**: relational databases including Oracle, MySQL, PostgreSQL (including AlloyDB and Cloud SQL variants) and SQL Server; additional sources have appeared over time. The supported source list, versions and limitations change — check current documentation.
- **Destinations**: direct replication into BigQuery (with tables kept up to date by merging changes, and configurable staleness to trade freshness against cost) or Avro/JSON files in Cloud Storage.
- **Backfill plus CDC**: a stream can perform an initial historical backfill and then continue with ongoing changes.
- **Log-based capture**: uses the source's native mechanisms, for example Oracle LogMiner or binary-log reading, MySQL binlog, PostgreSQL logical decoding with a publication and replication slot, and SQL Server change tables or transaction logs.
- **Connectivity**: IP allowlisting, forward SSH tunnel, or private connectivity via VPC peering / Private Service Connect interfaces.

## Migration-relevant considerations

- **Source prerequisites**: Oracle needs ARCHIVELOG mode and supplemental logging; PostgreSQL needs logical replication enabled; MySQL needs row-based binlog. Get DBA sign-off early.
- **Replication slots** (PostgreSQL) retain WAL until consumed; a paused or failed stream can fill the source disk. Monitor slot lag.
- **Schema changes**: understand how added/dropped columns and type changes propagate, and test with representative DDL.
- **Data types**: some source types (for example Oracle `NUMBER` without precision, large objects, spatial types, interval types) map with caveats or are unsupported; review the type-mapping tables.
- **Lakehouse targets**: for Databricks or Iceberg-based lakes, the common pattern is Datastream → Cloud Storage files → Auto Loader or Spark → MERGE into Delta tables, using source log position/timestamp for ordering.

## Common pitfalls

- Underestimating backfill duration and source load on very large tables; plan backfill windows and parallelism.
- Assuming exactly-once delivery to file destinations; downstream processing should be idempotent and deduplicate by primary key and change position.
- Network design left late; private connectivity to on-premises databases typically needs Cloud Interconnect or VPN and firewall changes.
- Not alerting on stream errors and latency in Cloud Monitoring.
