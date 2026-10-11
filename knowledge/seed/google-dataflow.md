---
vendor: Google Cloud
product: Dataflow
title: Dataflow — managed Apache Beam for batch and streaming
url: https://cloud.google.com/dataflow/docs/overview
doc_type: curated-note
technologies: [google-dataflow, gcp, google-pubsub, bigquery, google-cloud-storage]
version: null
---

## What it is

Dataflow is Google Cloud's fully managed service for running Apache Beam pipelines. Beam provides a unified programming model (Java, Python, Go, plus SQL and YAML options) for batch and streaming; Dataflow provisions workers, autoscales, and manages execution.

## Key capabilities

- **Unified batch and streaming** with Beam concepts: PCollections, transforms, windowing, triggers, watermarks and stateful processing.
- **Templates**: classic and Flex templates, plus Google-provided templates for common patterns (for example Pub/Sub to BigQuery, Datastream to BigQuery, JDBC to BigQuery, Cloud Storage text to BigQuery).
- **Autoscaling** horizontally (and vertically with some options), *Streaming Engine* to move state and shuffle off worker VMs, and *Dataflow Shuffle* for batch.
- **Streaming modes**: exactly-once processing by default, with an at-least-once mode available for lower cost and latency where duplicates are tolerable.
- **Operations**: job graph and metrics in the console, integration with Cloud Monitoring/Logging, in-place job updates and drain/cancel operations for streaming jobs.

## Migration-relevant considerations

- **Replacing legacy ETL**: Dataflow suits high-volume transformations, streaming enrichment and CDC application. For SQL-centric warehouse transformations, ELT inside BigQuery (with Dataform or dbt) is often simpler.
- **Replacing Spark**: existing Spark code usually moves more cheaply to Dataproc or Databricks than to Beam; rewriting in Beam is a refactor, not a lift-and-shift.
- **Pipeline updates**: changing a streaming pipeline's graph may require a compatible update or drain-and-replace; plan release procedures accordingly.
- **Networking and security**: workers run in the customer VPC; use private IPs, CMEK and appropriate service accounts for regulated workloads.

## Common pitfalls

- Misunderstanding windowing and late-data handling, producing incomplete aggregates.
- Hot keys that limit parallelism; use combiners or key salting.
- Unbounded side inputs or large per-key state causing memory pressure.
- Leaving streaming jobs over-provisioned; review autoscaling limits and worker types for cost.
