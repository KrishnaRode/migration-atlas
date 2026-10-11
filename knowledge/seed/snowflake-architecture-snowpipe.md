---
vendor: Snowflake
product: Snowflake and Snowpipe
title: Snowflake architecture and Snowpipe continuous loading
url: https://docs.snowflake.com/en/user-guide/data-load-snowpipe-intro
doc_type: curated-note
technologies: [snowflake, snowpipe, amazon-s3, adls-gen2, google-cloud-storage, apache-kafka, snowflake-horizon]
version: null
---

## Architecture in brief

Snowflake is a SaaS data platform running on AWS, Azure and Google Cloud. Its architecture has three layers: **storage** (data held in compressed columnar *micro-partitions* in cloud object storage managed by Snowflake), **compute** (independent *virtual warehouses* sized XS upwards, which can auto-suspend, auto-resume and, in multi-cluster mode, scale out for concurrency) and **cloud services** (metadata, optimisation, security, transactions). Because storage and compute are separate, many warehouses can query the same data without contention.

Notable features: Time Travel (query/restore past data within a retention period) and Fail-safe (a further non-queryable recovery period), zero-copy cloning, secure data sharing, automatic clustering with optional clustering keys, Snowpark for Python/Java/Scala processing, support for Apache Iceberg tables, and governance capabilities grouped under Snowflake Horizon.

## Snowpipe

Snowpipe loads files continuously from a *stage* (internal, or external on S3/ADLS/GCS) using a `COPY INTO` statement wrapped in a `PIPE` object.

- **Triggering**: auto-ingest via cloud event notifications (S3 event notifications/SNS/SQS, Azure Event Grid, GCS Pub/Sub), or calls to the Snowpipe REST API.
- **Compute**: serverless, billed per compute used plus a per-file overhead component (the pricing model has changed over time; check current documentation).
- **Latency**: typically within minutes of file arrival; not guaranteed ordering across files.
- **Load metadata** prevents re-loading the same file for a retention period (14 days for Snowpipe).
- **Snowpipe Streaming** is a separate API for row-level, low-latency ingestion (used, for example, by the Snowflake Kafka connector), without staging files.

## Migration-relevant considerations

- **SQL translation**: Snowflake SQL is ANSI-oriented with its own extensions; Teradata, Oracle, Netezza and SQL Server code needs conversion (Snowflake offers SnowConvert tooling; check current coverage). Stored procedures can be written in Snowflake Scripting, JavaScript, Python, Java or Scala.
- **No indexes or distribution keys**: performance relies on micro-partition pruning, clustering and warehouse sizing, not index design.
- **File sizing**: Snowflake guidance favours roughly 100–250 MB compressed files for loading; very small files raise Snowpipe overhead.
- **CDC**: apply change files with `MERGE`, or use streams and tasks / dynamic tables for incremental processing.

## Common pitfalls

- Warehouses left running or oversized; set auto-suspend and resource monitors.
- Expecting Snowpipe to deduplicate records (it deduplicates files, not rows).
- Long Time Travel retention on high-churn tables increasing storage costs.
- Case sensitivity of quoted identifiers when migrating from case-insensitive platforms.
