---
vendor: AWS
product: Amazon Redshift
title: Amazon Redshift — cloud data warehouse on AWS
url: https://docs.aws.amazon.com/redshift/latest/mgmt/welcome.html
doc_type: curated-note
technologies: [amazon-redshift, aws, amazon-s3, teradata, netezza, oracle-database]
version: null
---

## What it is

Amazon Redshift is AWS's managed, columnar, massively parallel processing (MPP) data warehouse. It is available as provisioned clusters (RA3 nodes with managed storage are the current recommended family) and as Redshift Serverless, which bills for compute capacity used.

## Key capabilities

- **Architecture**: a leader node plans queries and compute nodes execute them in parallel slices; RA3 separates compute from Redshift Managed Storage backed by S3.
- **Table design**: distribution styles (AUTO, EVEN, KEY, ALL) and sort keys (compound or interleaved, or AUTO) determine data placement and pruning; automatic table optimisation can choose them.
- **Lake integration**: Redshift Spectrum queries data in S3 via the Glue Data Catalog; data lake export (UNLOAD to Parquet) and support for Iceberg tables exist — check current documentation for format coverage.
- **Data sharing** across clusters, workgroups and accounts without copying data; concurrency scaling for burst read workloads.
- **Ingestion**: `COPY` from S3 and other sources, streaming ingestion from Kinesis and MSK, and zero-ETL integrations from Aurora, RDS and other sources.
- **SQL**: PostgreSQL-derived dialect with stored procedures (PL/pgSQL-like), materialized views, and ML via Redshift ML.

## Migration-relevant considerations

- **From Teradata/Netezza**: concepts map reasonably (MPP, distribution keys), but tuning differs; Teradata primary index ≠ Redshift distribution key in behaviour. AWS SCT/DMS Schema Conversion can translate DDL and much of the SQL; BTEQ, macros and NZPLSQL need manual or tool-assisted refactoring.
- **Unsupported PostgreSQL features**: Redshift is not full PostgreSQL; many types, functions and constraints behave differently (primary and foreign keys are informational, not enforced).
- **Loading**: use `COPY` from compressed, evenly sized files in S3 instead of row-by-row inserts.
- **Workload management**: configure automatic WLM queues and query priorities to replicate legacy workload classes.

## Common pitfalls

- Relying on unenforced primary keys and getting duplicate rows after CDC replay.
- Poor distribution keys causing data skew and network redistribution.
- Not running or relying on automatic VACUUM/ANALYZE after large deletes and loads.
- Assuming Serverless removes the need for cost guardrails; set usage limits.
