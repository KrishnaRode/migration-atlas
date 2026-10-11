---
vendor: Databricks
product: Auto Loader
title: Auto Loader — incremental file ingestion from cloud object storage
url: https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/
doc_type: curated-note
technologies: [databricks-auto-loader, databricks, amazon-s3, adls-gen2, google-cloud-storage, delta-bronze]
version: null
---

## What it is

Auto Loader is a Structured Streaming source (format `cloudFiles`) that incrementally and efficiently processes new files as they arrive in cloud object storage (S3, ADLS Gen2, GCS) or Unity Catalog volumes. It is the usual way to populate bronze tables from landing zones fed by upstream extracts or CDC tools.

## Key capabilities

- **Exactly-once file tracking**: discovered files are recorded in the stream checkpoint, so files are processed once even across restarts.
- **Discovery modes**: *directory listing* (simple, no extra cloud setup) and *file notification* modes that use cloud events and queues to scale to very large directories. Databricks has also introduced managed file-event options tied to Unity Catalog external locations; check current documentation for the recommended mode.
- **Schema inference and evolution**: infers schema for JSON, CSV, XML, Parquet, Avro and other formats, stores it at a `schemaLocation`, and supports evolution modes (add new columns, rescue, fail, none). Unparseable or unexpected fields can be captured in a `_rescued_data` column.
- **Batch-like scheduling**: with `trigger(availableNow=True)` the stream processes everything pending and stops, making it suitable for scheduled jobs as well as continuous streams.
- **Integration**: works inside notebooks, jobs and Lakeflow Declarative Pipelines.

## Migration-relevant considerations

- **Landing zone contract**: agree file naming, partition-style folder layout, file formats, compression, and how upstream signals completeness. Auto Loader processes files, not "batches", so a half-written file or a multi-file logical batch needs a convention (write-then-rename, manifest files, or downstream windowing).
- **Backfill**: initial runs over years of historical files can take a long time; consider `includeExistingFiles`, rate limits such as `maxFilesPerTrigger`/`maxBytesPerTrigger`, and separate backfill jobs.
- **CDC files**: when upstream tools (DMS, Datastream, GoldenGate) write change files, Auto Loader lands them in bronze and a downstream MERGE or AUTO CDC flow applies them in order using a sequence column.
- **Mainframe or EBCDIC extracts** should be converted to a standard encoding (or parsed with a copybook-aware reader) before relying on schema inference.

## Common pitfalls

- Deleting or moving the checkpoint, which causes all files to be reprocessed.
- Using schema inference in production without pinning hints for critical columns (for example decimals and dates inferred as strings).
- Overwriting files in place with the same name; by default the modified file may not be reprocessed (behaviour is controlled by options such as `cloudFiles.allowOverwrites`).
- Very many tiny files; compact upstream where possible.
