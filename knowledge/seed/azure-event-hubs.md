---
vendor: Microsoft
product: Azure Event Hubs
title: Azure Event Hubs — event streaming with a Kafka-compatible endpoint
url: https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-about
doc_type: curated-note
technologies: [azure-event-hubs, azure, apache-kafka, adls-gen2, azure-stream-analytics, spark-structured-streaming]
version: null
---

## What it is

Azure Event Hubs is a fully managed, partitioned event-ingestion and streaming service. Producers send events to an *event hub* (comparable to a Kafka topic) within a *namespace*; consumers read via *consumer groups*. Event Hubs exposes a Kafka protocol endpoint, so many Kafka clients can connect with configuration changes rather than code changes.

## Key capabilities

- **Partitions and consumer groups**: ordering is guaranteed within a partition; each consumer group maintains its own position (offset) in each partition.
- **Tiers**: Basic, Standard, Premium and Dedicated, which differ in capacity units (throughput units, processing units, capacity units), retention limits, Kafka support and isolation. Check current documentation for limits per tier.
- **Capture**: automatically writes events to ADLS Gen2 or Blob Storage in Avro format (Parquet output is available through the Stream Analytics no-code editor), useful for landing raw streams in the lake.
- **Schema Registry** for Avro/JSON schemas; geo-disaster recovery and geo-replication options.
- **Integrations**: Azure Stream Analytics, Azure Functions, Fabric Real-Time Intelligence, Spark Structured Streaming (Databricks) via the Kafka endpoint or native connector.

## Migration-relevant considerations

- **From self-managed Kafka**: verify the features you depend on. Kafka Streams, transactions, compacted topics and Kafka Connect support vary by tier, and Event Hubs is not a full Kafka broker (no ZooKeeper/KRaft administration, different quotas, broker configs not exposed). Confluent Cloud on Azure is an alternative when full Kafka semantics are required.
- **Partition count planning**: partition counts are fixed at creation in some tiers; size for peak parallelism.
- **Retention**: Event Hubs is not designed as long-term storage; use Capture or downstream sinks for history.
- **Security**: prefer Microsoft Entra ID authentication and private endpoints over shared access keys.

## Common pitfalls

- Too few partitions limiting consumer throughput.
- Multiple applications sharing one consumer group and stealing each other's partitions.
- Throttling because throughput or processing units are undersized; enable auto-inflate where appropriate.
- Checkpointing too infrequently, causing large replays after consumer restarts.
