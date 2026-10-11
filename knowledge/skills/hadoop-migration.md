---
id: hadoop-migration
title: Hadoop migration (Cloudera/HDP, HDFS, Hive, Impala, Oozie, Spark → cloud)
triggers:
  technologies: [cloudera-hadoop, hdfs, apache-spark, google-dataproc, amazon-emr, databricks, delta-lake, apache-iceberg, amazon-s3, adls-gen2, google-cloud-storage, apache-airflow, unity-catalog]
  roles: [processing, lakehouse, object-storage]
  keywords: [hadoop, cloudera, hortonworks, hdp, cdh, hdfs, hive, impala, oozie, hbase, ranger, sentry, kerberos, yarn, mapreduce, pig, sqoop]
priority: 5
---

## Options
- **Lift to managed Hadoop/Spark** (Dataproc, EMR, Cloudera on cloud; check Microsoft's current HDInsight roadmap before choosing it): fastest, minimal code change; keeps cluster-oriented operating model.
- **Replatform to lakehouse** (Databricks, or Spark on EMR/Dataproc with Iceberg/Delta, plus a warehouse for SQL): separate storage from compute, adopt open table formats and serverless SQL. Best long-term economics and governance for most estates.
- **Warehouse-centric** (BigQuery, Snowflake, Redshift): good when Hive/Impala SQL is the majority and little custom Spark/MapReduce exists.
- Hybrid during migration is normal; avoid stretching on-prem HDFS and cloud storage for long periods.

## Component mapping
- HDFS → object storage (S3, ADLS Gen2, GCS). Object stores are not file systems: renames are not atomic everywhere, listing is slow at scale — table formats (Delta/Iceberg) solve this.
- Hive tables → Delta/Iceberg tables or warehouse tables; Hive Metastore → Unity Catalog, Glue Data Catalog, Dataproc Metastore/BigLake.
- Impala/Hive SQL → Databricks SQL, Trino/Athena, BigQuery, Snowflake. Watch for Hive-specific UDFs, SerDes, `INSERT OVERWRITE` partition semantics, and implicit type coercion.
- Spark jobs → mostly portable; upgrade Spark/Scala/Python versions (Spark 2 → 3 behaviour changes, e.g., datetime parsing, ANSI mode) and remove HDFS-local assumptions.
- MapReduce, Pig → rewrite in Spark SQL/DataFrames; no shortcut.
- Oozie → Airflow, Databricks Workflows, Step Functions; coordinators/datasets become schedules or event triggers.
- Sqoop → CDC/ingestion services or Spark JDBC; Flume → Kafka/managed streaming.
- HBase → Bigtable (HBase-compatible API), DynamoDB, or managed HBase; re-evaluate access patterns.
- Ranger/Sentry policies → Unity Catalog / Lake Formation / BigQuery IAM; translate, then simplify. Kerberos → cloud IAM and workload identity.

## Sequencing
1. Inventory from cluster metadata: Hive Metastore, YARN job history, Oozie definitions, Ranger policies, HDFS usage. Identify cold data (often a large share) for archive tiers or deletion.
2. Data transfer: DistCp or cloud transfer services over interconnect; offline appliances for very large volumes. Convert to Parquet + table format during or after landing.
3. Migrate by workload/domain: ingest → transform → consumers, with parallel run.
4. Decommission nodes progressively to realise savings (licence and hardware renewal dates drive urgency).

## Sizing signals
Do not size cloud compute to match cluster node count. Most clusters are sized for peak and idle much of the time; profile YARN utilisation and design autoscaling/ephemeral job clusters.

## What to ask
Data volume (raw and after replication factor — HDFS 3x replication inflates numbers), hot vs cold data, job counts by engine, SQL vs code share, security/Kerberos dependencies, Cloudera licence end date.

## Red flags
- Counting HDFS capacity including replication as data to migrate.
- Moving small files as-is; object storage and query engines will suffer.
- Long-lived, always-on cloud clusters replicating on-prem sizing.
- No plan for Ranger policy translation and audit.
