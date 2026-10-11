---
vendor: Apache Software Foundation
product: Apache Kafka
title: Apache Kafka — distributed event streaming platform
url: https://kafka.apache.org/documentation/
doc_type: curated-note
technologies: [apache-kafka, confluent-cloud, amazon-msk, debezium, spark-structured-streaming, apache-flink]
version: null
---

## What it is

Apache Kafka is an open-source distributed event streaming platform. Producers write records to *topics*, which are split into *partitions* replicated across *brokers*; consumers read records by offset, usually as members of *consumer groups*. Kafka is used for event-driven architectures, log aggregation, CDC transport and streaming analytics. Managed options include Confluent Cloud, Amazon MSK, Google Cloud Managed Service for Apache Kafka and Azure Event Hubs' Kafka endpoint (not a full Kafka implementation).

## Key concepts

- **Ordering and parallelism**: ordering is guaranteed within a partition; the partition count bounds consumer parallelism within a group.
- **Durability**: replication factor and `min.insync.replicas` together with producer `acks=all` determine durability guarantees.
- **Retention**: time- or size-based retention, or *log compaction* that keeps the latest value per key (useful for changelog/state topics).
- **Delivery semantics**: at-least-once by default; idempotent producers and transactions enable exactly-once processing within Kafka (for example Kafka Streams).
- **Ecosystem**: Kafka Connect for source/sink connectors (including Debezium for database CDC), Kafka Streams for stream processing; schema registries (for example Confluent Schema Registry or Apicurio) are separate projects.
- **KRaft**: Kafka's built-in Raft-based metadata quorum replaces ZooKeeper; Kafka 4.0 removed ZooKeeper mode entirely, so ZooKeeper-based clusters must migrate to KRaft before upgrading.

## Migration-relevant considerations

- **From IBM MQ/JMS**: Kafka is a log, not a queue; per-message acknowledgement, selectors, priorities and request/reply patterns need redesign.
- **Cluster migration** (on-premises → managed): MirrorMaker 2 or vendor replication tools copy topics and translate consumer offsets; plan producer and consumer cutover order.
- **Lakehouse ingestion**: Spark Structured Streaming, Flink, Kafka Connect sinks or managed connectors write to Delta/Iceberg; design for duplicates and ordering by key.
- **Schema governance**: introduce schemas and compatibility rules before many teams depend on topics.

## Common pitfalls

- Too few partitions (limits parallelism) or far too many (overhead); increasing partitions changes key-to-partition mapping.
- Hot partitions due to skewed keys.
- Retention shorter than consumer recovery time, causing data loss after outages.
- Unauthenticated, unencrypted listeners carried into the cloud; enable TLS, SASL and ACLs.
