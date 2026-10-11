---
vendor: AWS
product: Amazon S3
title: Amazon S3 data lake basics
url: https://docs.aws.amazon.com/whitepapers/latest/building-data-lakes/building-data-lake-aws.html
doc_type: curated-note
technologies: [amazon-s3, aws, aws-glue-data-catalog, aws-lake-formation, apache-iceberg, delta-lake, raw-layer, curated-layer]
version: null
---

## What it is

Amazon S3 is AWS's object storage service and the standard storage layer for data lakes on AWS. Engines such as Athena, Redshift Spectrum, EMR, Glue, Databricks and Snowflake read data in place from S3, typically in open formats (Parquet, ORC, Avro) and table formats (Apache Iceberg, Delta Lake, Hudi).

## Key capabilities

- **Consistency**: S3 provides strong read-after-write consistency for PUTs and DELETEs and for list operations.
- **Performance**: request rates scale per prefix (AWS documents at least 3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD requests per second per partitioned prefix); spread hot workloads across prefixes.
- **Storage classes**: Standard, Intelligent-Tiering, Standard-IA, One Zone-IA, Glacier tiers; lifecycle rules transition or expire objects.
- **Security**: Block Public Access, bucket policies, IAM, SSE-S3/SSE-KMS encryption (default encryption is on for new objects), VPC endpoints, Object Lock for WORM.
- **Catalog and governance**: the AWS Glue Data Catalog holds table metadata; AWS Lake Formation adds fine-grained (database/table/column/row) permissions on top.
- **Managed tables**: S3 Tables provides managed Iceberg tables with automatic maintenance; check current documentation for feature and regional availability.

## Migration-relevant considerations

- **Zones**: a typical layout uses separate buckets or prefixes for raw/landing, cleansed and curated data, with different retention and access controls.
- **Table formats**: choose Iceberg, Delta or Hudi deliberately based on the engines in scope; plain Parquet folders lack transactions and make updates and CDC application error-prone.
- **Bulk data movement**: AWS DataSync, Snowball devices, Direct Connect, and S3 Transfer Acceleration cover different volume and bandwidth scenarios.
- **Permissions model**: mixing raw IAM/bucket policies with Lake Formation grants requires careful design so engines do not bypass Lake Formation.

## Common pitfalls

- Small-file proliferation from streaming or per-record writes; compact into files of roughly hundreds of MB.
- Over-partitioning by high-cardinality columns, producing millions of prefixes and slow planning.
- Hardcoding bucket names and access keys in jobs instead of IAM roles.
- Lifecycle rules that transition data needed for reprocessing into Glacier classes.
