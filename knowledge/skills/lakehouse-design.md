---
id: lakehouse-design
title: Lakehouse design (medallion, Delta/Iceberg/Hudi, catalog, file sizing)
triggers:
  technologies: [databricks, delta-lake, apache-iceberg, unity-catalog, delta-bronze, delta-silver, delta-gold, raw-layer, staging-layer, curated-layer, amazon-s3, adls-gen2, google-cloud-storage, databricks-auto-loader, aws-glue-data-catalog, aws-lake-formation, microsoft-fabric]
  roles: [lakehouse, lake-layer, object-storage]
  keywords: [lakehouse, medallion, bronze, silver, gold, delta, iceberg, hudi, open table format, small files, partitioning, z-order, liquid clustering, data lake]
priority: 5
---

## Medallion, used sensibly
- **Bronze/raw**: immutable copy of source as received (plus ingest metadata: source file, load timestamp, op type for CDC). Append-only; enables replay.
- **Silver/cleansed**: typed, deduplicated, conformed keys, CDC applied (MERGE), basic quality rules. One table per business entity.
- **Gold/curated**: consumption-shaped — dimensional models, aggregates, feature tables, data products.
- Layers are a convention, not a law. Two layers are fine for simple sources; do not create five because a diagram showed five. Each layer must earn its storage and pipeline cost.

## Table format choice
- **Delta Lake**: native on Databricks and Fabric; mature MERGE, time travel, change data feed.
- **Apache Iceberg**: broadest multi-engine support (Spark, Trino, Flink, Snowflake, BigQuery, Athena, etc.); strong choice for engine neutrality.
- **Apache Hudi**: strong for upsert-heavy, incremental ingestion on AWS/EMR; smaller ecosystem today.
- Interoperability is improving (Delta UniForm, Iceberg REST catalogs, XTable); verify current read/write support per engine before promising "any engine can write".
- Pick one primary format per platform; the catalog choice usually matters more than the format.

## Catalog and governance
- Use one governed catalog per estate: Unity Catalog (Databricks), AWS Glue Data Catalog + Lake Formation, Dataplex/BigLake (GCP), OneLake/Purview (Fabric/Azure), Snowflake Horizon for Snowflake-managed Iceberg.
- Separate storage locations per environment and per sensitivity tier; never let users write directly to bronze paths.
- Prefer managed tables where the platform offers automatic optimisation; use external tables when other engines must own or read files directly.

## Physical design
- Target file sizes roughly 128 MB–1 GB; small files are the most common performance problem. Use auto-compaction/optimize features and batch micro-writes.
- Partition only on low-cardinality columns that queries filter on (often date); over-partitioning creates millions of tiny files. Under ~1 TB tables often need no partitioning.
- Use clustering (Z-order, liquid clustering, Iceberg sort orders) for high-cardinality filter columns; verify current feature availability.
- Schedule VACUUM/snapshot expiry with retention aligned to time-travel and audit requirements.

## Ingestion patterns
- Files: incremental file discovery (Auto Loader, event notifications) instead of listing huge directories.
- CDC: land change records in bronze, MERGE into silver with ordering by source commit sequence.
- Schema evolution: allow additive changes automatically in bronze; gate breaking changes before silver.

## What to ask
Data volume and growth, number of sources, latency needs, engines that must read/write, BI concurrency, sensitivity classes, retention and right-to-erasure requirements.

## Red flags
- Bronze used as the reporting layer.
- Partitioned by customer id or timestamp-to-the-second.
- Multiple catalogs with conflicting permissions over the same files.
- GDPR deletes required but time-travel retention and VACUUM policy not designed.
- No data contracts between bronze producers and silver consumers.
