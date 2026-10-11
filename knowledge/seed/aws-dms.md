---
vendor: AWS
product: AWS Database Migration Service
title: AWS DMS — database migration and change data capture
url: https://docs.aws.amazon.com/dms/latest/userguide/Welcome.html
doc_type: curated-note
technologies: [aws-dms, aws, oracle-database, sql-server, postgresql, mysql, amazon-s3, amazon-redshift, amazon-aurora]
version: null
---

## What it is

AWS Database Migration Service (DMS) migrates data between databases and other data stores, supporting one-time full loads, ongoing replication via change data capture (CDC), or both. Sources and targets can be on-premises, on EC2, or managed AWS services; at least one endpoint is normally in AWS.

## Key capabilities

- **Replication tasks**: *full load*, *full load + CDC*, or *CDC only*, with table mappings (selection and transformation rules) and task settings for LOB handling, error behaviour and validation.
- **Endpoints**: a broad set of relational sources (Oracle, SQL Server, PostgreSQL, MySQL/MariaDB, Db2, SAP ASE and others) and targets including RDS/Aurora, Redshift, S3 (CSV or Parquet), Kinesis, MSK/Kafka, DynamoDB and OpenSearch. Supported versions change; check current documentation.
- **Deployment options**: provisioned replication instances or DMS Serverless, which scales capacity automatically.
- **Schema conversion**: DMS Schema Conversion (managed) and the AWS Schema Conversion Tool (desktop) convert schemas and code between heterogeneous engines and report items needing manual work.
- **Data validation**: optional row-level comparison between source and target during and after migration.

## Migration-relevant considerations

- **DMS moves data, not everything else**: secondary indexes, constraints, triggers, sequences, users and stored code are generally not migrated by the replication task; create them via schema conversion or scripts, often after full load for performance.
- **Source prerequisites for CDC**: Oracle requires ARCHIVELOG and supplemental logging (LogMiner or Binary Reader); SQL Server needs MS-CDC or MS-Replication setup; PostgreSQL needs logical replication slots; MySQL needs row-based binlog with adequate retention.
- **Lake targets**: writing CDC to S3 as Parquet with timestamps/operation columns, then applying changes with Glue, EMR, Databricks or Iceberg MERGE, is a common lakehouse ingestion pattern.
- **LOBs**: limited LOB mode truncates beyond the configured size; full LOB mode is slower. Profile LOB sizes first.

## Common pitfalls

- Undersized replication instances or storage causing swap and growing CDC latency.
- Tables without primary keys, which complicate CDC updates/deletes and validation.
- Transaction log retention on the source shorter than a possible DMS outage, forcing a full reload.
- Assuming DMS converts data types perfectly across engines; test numeric precision, time zones and character sets.
