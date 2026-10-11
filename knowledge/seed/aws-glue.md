---
vendor: AWS
product: AWS Glue
title: AWS Glue — serverless data integration and the Glue Data Catalog
url: https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html
doc_type: curated-note
technologies: [aws-glue, aws-glue-data-catalog, aws, amazon-s3, apache-spark, informatica-powercenter]
version: null
---

## What it is

AWS Glue is a serverless data integration service. It combines a metadata repository (the Glue Data Catalog), crawlers for schema discovery, and serverless execution of ETL jobs built on Apache Spark (Python or Scala) or lightweight Python shell jobs, plus visual authoring in Glue Studio.

## Key capabilities

- **Glue Data Catalog**: a Hive-metastore-compatible catalog used by Athena, EMR, Redshift Spectrum, Lake Formation and third-party engines; supports Iceberg table metadata.
- **Crawlers**: infer schemas and partitions from S3 and JDBC sources and register tables.
- **ETL jobs**: Spark jobs sized in DPUs (data processing units) with worker types; Glue versions pin Spark and Python versions. Job bookmarks track processed data for incremental runs. Flex execution offers lower cost for non-urgent jobs.
- **Glue Studio** visual editor and **Glue DataBrew** for no-code data preparation; data quality rules (DQDL) for validating datasets.
- **Connections** to JDBC databases and SaaS sources; streaming ETL from Kinesis and Kafka.
- **Workflows and triggers** for simple orchestration (often replaced by Step Functions or MWAA for complex flows).

## Migration-relevant considerations

- **From Informatica/DataStage/SSIS**: Glue is code-centric Spark. Mapping-level logic (lookups, routers, aggregators, update strategies) translates to DataFrame operations; expect a refactor rather than a one-to-one conversion. Visual Glue Studio jobs can help analysts, but complex legacy mappings usually end up as code.
- **Catalog as shared contract**: many engines depend on the Glue Data Catalog; govern it with Lake Formation and IaC.
- **Version upgrades**: each Glue version has a support lifecycle; plan upgrades and regression tests.
- **Cost**: billed per DPU-hour with a minimum duration; many tiny jobs can be more expensive than consolidated ones.

## Common pitfalls

- Crawlers inferring inconsistent schemas or creating unwanted tables from messy folder layouts; prefer explicit DDL for curated zones.
- Relying on job bookmarks for correctness without understanding their limits (for example with modified files or certain sources).
- Collecting large datasets to the driver or using Python UDFs in hot paths.
- Treating Glue workflows as an enterprise scheduler replacement for complex dependency graphs.
