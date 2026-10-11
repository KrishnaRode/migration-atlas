---
vendor: Google Cloud
product: Migration planning guidance
title: Cutover planning and rollback for data platform migrations
url: https://cloud.google.com/architecture/migration-to-gcp-getting-started
doc_type: curated-note
technologies: [reconciliation-framework, oracle-goldengate, aws-dms, google-datastream, tableau, power-bi]
version: null
---

## Purpose

Cutover is the controlled switch of producers, consumers and operations from the legacy platform to the target. Most migration failures surface here, so it deserves its own plan, rehearsals and explicit rollback criteria. This note is vendor-neutral; cloud providers publish general migration frameworks (assess, plan, deploy, optimise) that frame the same activities.

## Cutover strategies

- **Big bang**: everything switches in one window. Simple to reason about, highest risk, requires a long enough outage window.
- **Phased (wave-based)**: domains, subject areas or applications move in waves; requires temporary bridges (replication back to legacy, dual feeds) for cross-wave dependencies.
- **Parallel run then switch**: both platforms run until reconciliation exit criteria are met, then consumers repoint.
- **Trickle / CDC-based near-zero downtime**: initial load plus continuous CDC (GoldenGate, DMS, Datastream, Qlik, Debezium) keeps the target current; cutover becomes a short freeze and switch.

## Runbook essentials

- Ordered, timed steps with owners, durations, verification checks and communication points; rehearse at least once end-to-end with production-like volumes.
- **Freeze**: change freeze on code, schema and job definitions for the cutover period.
- **Final sync**: stop writers, drain CDC to zero lag, record source positions (SCN/LSN), run final reconciliation.
- **Repoint**: application connection strings, ETL targets, schedulers, BI data sources, DNS/aliases, firewall rules and credentials.
- **Go/no-go gates** with explicit criteria (reconciliation passed, performance tests passed, support team ready, rollback tested).
- **Hypercare**: elevated support and monitoring for an agreed period after go-live.

## Rollback

- Define the *point of no return* — typically when new transactions are written only to the target.
- Before that point, rollback means repointing consumers back to legacy, which must remain intact and un-decommissioned.
- After it, rollback needs reverse replication (target → legacy) or a reconcile-and-replay procedure; decide in advance whether this is supported or whether the strategy is fix-forward.
- Keep legacy read-only and backed up for a defined retention period; licences and support contracts must cover this period.

## Common pitfalls

- No rehearsal, so step durations are guesses.
- Forgotten consumers (extracts, partner feeds, spreadsheets with ODBC connections) that break on day one.
- Decommissioning legacy before hypercare ends.
- Rollback criteria not agreed, leading to indecision during an incident.
