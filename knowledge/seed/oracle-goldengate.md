---
vendor: Oracle
product: Oracle GoldenGate
title: Oracle GoldenGate — log-based replication and CDC
url: https://docs.oracle.com/en/middleware/goldengate/index.html
doc_type: curated-note
technologies: [oracle-goldengate, oracle-database, apache-kafka, delta-lake, bigquery, snowflake]
version: null
---

## What it is

Oracle GoldenGate is Oracle's real-time data replication and change data capture product. It captures committed transactions from database logs and delivers them to target databases, messaging systems, cloud storage and data platforms with low latency. It is available as licensed software and as a managed service (OCI GoldenGate), and has distributions for heterogeneous sources and big data/streaming targets (historically "GoldenGate for Big Data", now part of GoldenGate for Distributed Applications and Analytics). Product packaging changes between releases; check current documentation.

## Key components

- **Extract** reads redo/transaction logs (for Oracle, typically *Integrated Extract* using LogMiner server) and writes changes to **trail files**.
- **Distribution/Data Pump** moves trail files to remote hosts.
- **Replicat** applies changes to the target (integrated, parallel or coordinated modes for performance).
- **Microservices Architecture** provides REST APIs and web UIs for administration; the older Classic Architecture is deprecated in recent releases.
- **Handlers** for targets such as Kafka, object storage (S3, ADLS, GCS), and data platforms including Databricks, Snowflake and BigQuery (coverage varies by release).

## Migration-relevant considerations

- **Zero/near-zero downtime migrations**: initial load (Data Pump export/import, RMAN, or GoldenGate initial load) at a known SCN, then CDC from that SCN keeps the target in sync until cutover. Bidirectional replication can support fallback.
- **Source prerequisites**: ARCHIVELOG mode, minimal and table-level supplemental logging, appropriate privileges, and adequate redo/archive retention.
- **Data types and DDL**: check support for LOBs, XMLType, spatial and user-defined types; DDL replication must be configured explicitly and is not supported to all targets.
- **Licensing**: GoldenGate is separately licensed; for cloud data platform ingestion, compare cost and fit with alternatives such as Datastream, AWS DMS, Qlik Replicate, Debezium or Lakeflow Connect.

## Common pitfalls

- Tables without primary keys or unique indexes, forcing GoldenGate to use all columns as a key and hurting apply performance and correctness.
- Trail-file disk filling up when the target is unavailable.
- Large batch updates on the source creating huge transactions and apply lag.
- Character-set and time-zone conversions not validated end-to-end.
