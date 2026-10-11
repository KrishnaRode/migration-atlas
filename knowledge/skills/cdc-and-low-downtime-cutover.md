---
id: cdc-and-low-downtime-cutover
title: CDC and low-downtime cutover
triggers:
  technologies: [oracle-goldengate, aws-dms, azure-dms, google-datastream, debezium, qlik-replicate, striim, lakeflow-connect, apache-kafka, confluent-cloud]
  roles: [cdc, source-database]
  keywords: [cdc, change data capture, replication, cutover, downtime, zero downtime, dual write, rollback, binlog, redo log, logminer, backfill]
priority: 6
---

## When you need CDC
- Source must stay live during migration and the cutover window is shorter than a full reload.
- Analytics needs near-real-time copies of OLTP data.
- You want a rollback path (reverse replication).
If a weekend outage covers a full reload and validation, a bulk reload is simpler and cheaper. Do not add CDC for its own sake.

## Choosing a tool
- **Native cloud services** (AWS DMS, Azure DMS, Google Datastream, Lakeflow Connect for Databricks targets): lowest operational effort; check source version support, LOB/large-column limits, DDL propagation behaviour and throughput ceilings in current docs.
- **Oracle GoldenGate**: highest fidelity for Oracle, bi-directional support, extra licence cost.
- **Debezium on Kafka**: open source, flexible fan-out, but you operate Kafka Connect, offsets and schema evolution yourself.
- **Qlik Replicate / Striim**: broad source coverage (incl. mainframe Db2, SAP), commercial licence, GUI-driven.
- Heuristic: one source → one target with no fan-out → managed service. Many consumers of the same change stream → Kafka-backed CDC.

## Mechanics that matter
- Log-based CDC requires source prerequisites: Oracle supplemental logging/archivelog, SQL Server CDC or change tracking, MySQL binlog in ROW format, PostgreSQL logical replication slots. Get DBA approval early.
- **Initial load + CDC alignment**: capture must start at or before the snapshot point (SCN/LSN), otherwise you lose or duplicate changes. Use the tool's built-in full-load-then-CDC mode where possible.
- Tables without primary keys break updates/deletes downstream; fix or define surrogate keys.
- Deletes: decide hard delete vs soft delete (`_is_deleted`, op type column) in the target.
- Ordering is per table/partition, not global; cross-table transactional consistency is usually not guaranteed downstream.
- Schema drift: decide whether DDL changes propagate automatically or are gated.
- Watch replication lag at peak (month-end batch), not at average load; size for 2–3x peak redo.
- PostgreSQL replication slots retain WAL if the consumer stops — disk can fill on the source.

## Cutover runbook pattern
1. Full load + CDC running; lag stable under peak for at least one business cycle.
2. Continuous reconciliation (counts, checksums on recent partitions).
3. Freeze window: stop writes on source (app maintenance mode), wait for lag = 0.
4. Final reconciliation on key tables; sequence/identity values reset on target.
5. Repoint applications (connection strings, DNS, secrets); smoke tests.
6. Start reverse replication (target → source) if rollback is required; define the rollback deadline explicitly.
7. Keep source read-only for an agreed period, then decommission.

## Downtime math
Downtime ≈ write freeze + lag drain + final validation + repoint + smoke test. Realistically 15–60 minutes for well-rehearsed OLTP cutovers; rehearse at least twice in a production-like environment and time each step.

## What to ask
RPO/RTO, peak change rate (rows/sec, GB/hour of redo), table count and largest tables, PK coverage, LOB usage, rollback requirement, and who can approve source configuration changes.

## Red flags
- No rehearsal; "we'll cut over on go-live night."
- Dual writes from application code without idempotency or reconciliation.
- CDC lag only measured in non-production.
- No plan for sequences, triggers or scheduled jobs firing on both sides.
