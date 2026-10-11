---
id: streaming-and-event-driven
title: Streaming and event-driven architecture (Kafka, MQ, Pub/Sub, Event Hubs, Kinesis)
triggers:
  technologies: [apache-kafka, confluent-cloud, amazon-msk, google-pubsub, azure-event-hubs, amazon-kinesis, ibm-mq, rabbitmq, activemq, apache-flink, spark-structured-streaming, google-dataflow, azure-stream-analytics, retry-dead-letter]
  roles: [streaming, stream-processing]
  keywords: [streaming, kafka, event, real-time, exactly-once, ordering, schema registry, pub/sub, kinesis, event hubs, mq, message queue, latency, dead letter]
priority: 5
---

## Queue vs log
- **Message queues** (IBM MQ, RabbitMQ, ActiveMQ, SQS, Service Bus): point-to-point or pub/sub delivery, messages removed on consumption, strong transactional semantics, ideal for commands and integration.
- **Event logs** (Kafka, Kinesis, Event Hubs, Pub/Sub with retention/replay): durable, replayable, multiple independent consumers, ideal for analytics, CDC and event sourcing.
- Do not replace MQ with Kafka by default. If apps rely on XA transactions, request/reply or per-message acknowledgment semantics, a managed queue may be the right target.

## Choosing a backbone
- Need Kafka API compatibility and ecosystem (Connect, Streams, ksqlDB): Confluent Cloud, Amazon MSK, Event Hubs Kafka endpoint, or self-managed Kafka.
- Cloud-native, serverless, low ops on one cloud: Pub/Sub (GCP), Kinesis (AWS), Event Hubs (Azure).
- Multi-cloud or hybrid with on-prem producers: Kafka (managed) is the usual neutral choice.
- Verify current quotas: partitions/shards, message size limits, retention limits, throughput units — they differ significantly.

## Semantics you must get right
- **Ordering** is per partition/shard/ordering key only. Choose keys deliberately (e.g., account id); hot keys cause skew.
- **Delivery**: assume at-least-once end to end. "Exactly-once" exists within specific boundaries (Kafka transactions + idempotent producers, Flink/Spark checkpointing with transactional or idempotent sinks, Dataflow's processing guarantees). Design sinks to be idempotent (upserts/MERGE on keys) regardless.
- **Late and out-of-order data**: use event time, watermarks and allowed lateness; decide what happens to very late records.
- **Schema management**: use a schema registry (Confluent, AWS Glue Schema Registry, Azure Schema Registry, Pub/Sub schemas) with Avro/Protobuf and enforced compatibility rules (backward is a sensible default).
- **Poison messages**: retries with backoff, then dead-letter topic/queue, with monitoring and a replay process.

## Stream processing choice
- Flink: low latency, rich state and event-time handling; managed options exist on each cloud.
- Spark Structured Streaming: good when the lakehouse is Spark/Databricks; micro-batch by default, fine for seconds-level latency.
- Dataflow (Beam): strong on GCP, unified batch/stream.
- Many "real-time" requirements are really 5–15 minute freshness; incremental batch is cheaper and simpler. Ask for the business latency, not the technical wish.

## Sizing signals
Peak events/sec, average and max message size, retention needed for replay, number of consumer groups, cross-region needs. Partition count is hard to reduce later; plan for 2–3 years of growth.

## What to ask
Latency SLA, ordering requirement and scope, duplicate tolerance, replay needs, payload format, producer ownership, regulatory retention, and DR (multi-region replication).

## Red flags
- "Exactly-once" promised without idempotent sinks.
- No schema registry; JSON blobs with implicit contracts.
- Kafka adopted for a single point-to-point integration.
- No dead-letter handling or consumer lag monitoring.
