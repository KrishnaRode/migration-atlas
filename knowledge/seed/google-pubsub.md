---
vendor: Google Cloud
product: Pub/Sub
title: Pub/Sub — global messaging and event ingestion
url: https://cloud.google.com/pubsub/docs/overview
doc_type: curated-note
technologies: [google-pubsub, gcp, google-dataflow, bigquery, apache-kafka]
version: null
---

## What it is

Pub/Sub is Google Cloud's fully managed, serverless publish/subscribe messaging service. Publishers send messages to *topics*; subscribers receive them through *subscriptions*. It is commonly used for event ingestion, decoupling microservices, and streaming pipelines with Dataflow.

## Key capabilities

- **Subscription types**: pull, push (to an HTTPS endpoint), and export subscriptions that write directly to BigQuery or Cloud Storage without custom code.
- **Delivery semantics**: at-least-once by default; exactly-once delivery is available for pull subscriptions within a region; message ordering per *ordering key* when enabled.
- **Retention and replay**: unacknowledged messages are retained for a configurable period (up to 7 days by default for subscriptions; topic retention can be configured longer — check current limits). *Seek* to a timestamp or snapshot enables replay.
- **Reliability features**: dead-letter topics, retry policies, filtering, schemas (Avro/Protocol Buffers) attached to topics.
- **Scale**: no partitions or brokers to manage; throughput scales automatically subject to quotas.

## Migration-relevant considerations

- **From Kafka**: Pub/Sub does not expose partitions, offsets or consumer-group semantics in the Kafka sense. Ordering is per key rather than per partition; replay uses seek rather than offset resets; compacted topics have no direct equivalent. If applications depend heavily on Kafka APIs, consider Google Cloud Managed Service for Apache Kafka or Confluent Cloud instead.
- **From IBM MQ / JMS**: queue semantics map to topic + single subscription; transactional and request/reply patterns need redesign.
- **Pub/Sub Lite** was deprecated; new designs should use standard Pub/Sub or managed Kafka.
- **Idempotency**: design consumers to tolerate duplicates even when exactly-once is enabled for some paths.

## Common pitfalls

- Assuming global ordering; ordering is only guaranteed per ordering key in a region.
- Leaving acknowledgement deadlines too short for slow consumers, causing redelivery storms.
- Not configuring dead-letter topics, so poison messages block progress or are retried indefinitely.
- Ignoring message size limits (currently 10 MB per message) when migrating large payloads; store large objects in Cloud Storage and send references.
