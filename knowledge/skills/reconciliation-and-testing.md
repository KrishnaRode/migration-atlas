---
id: reconciliation-and-testing
title: Reconciliation and testing (counts, checksums, aggregates, parallel run, sign-off)
triggers:
  technologies: [reconciliation-framework, great-expectations, google-dvt, lakehouse-monitoring]
  roles: [data-quality]
  keywords: [reconciliation, validation, testing, row counts, checksum, hash, parity, parallel run, sign-off, data quality, uat, regression, mismatch]
priority: 6
---

## Why it decides success
Business users do not trust a migrated platform because it is faster; they trust it because the numbers match. Plan reconciliation as a product with its own backlog, automation and owners, starting in week one.

## Layered validation (cheapest first)
1. **Structural**: object existence, column names, data types, nullability, constraints, partitioning.
2. **Row counts**: per table and per partition/date slice; filter for the same snapshot point.
3. **Column aggregates**: sum, min, max, count distinct, null count, average length for strings — per partition. Catches truncation, precision and encoding errors quickly.
4. **Row-level hashes**: compute a hash of a canonicalised row (trimmed strings, normalised timestamps/time zones, fixed decimal scale, consistent NULL representation) on both sides, keyed by primary key; compare to find missing, extra and changed rows. Apply fully on critical tables, sampled on large low-risk ones.
5. **Business-level**: key reports, KPIs and regulatory outputs reproduced for the same periods.

## Tooling
- Google Data Validation Tool (open source, multi-engine), Great Expectations / dbt tests for rules, platform-native monitoring, vendor reconciliation features in migration tools, or a custom framework that writes results to a reconciliation table with run ids.
- Push computations to each engine (aggregate SQL both sides) instead of extracting full datasets.

## Classic mismatch causes
Decimal scale and rounding, floating point aggregation order, timestamp time-zone conversion, DATE vs TIMESTAMP, trailing spaces and CHAR padding, empty string vs NULL (Oracle), case sensitivity and collation, character encoding (EBCDIC, Latin-1 vs UTF-8), duplicate handling (Teradata SET tables), late-arriving CDC changes, and different snapshot times. Document accepted tolerances per type up front.

## Parallel run
- Run legacy and new pipelines on the same inputs for at least one full business cycle including month-end (quarter-end for finance).
- Automate daily comparison; track mismatch trends and root causes in a defect log.
- Define exit criteria in advance: e.g., zero unexplained variance on critical tables for N consecutive runs, agreed tolerance on others.
- Limit the parallel period — dual running is expensive and teams drift.

## Sign-off
- Data owner per domain signs off with evidence (reconciliation reports, defect closure, performance results).
- Keep evidence for audit, especially in regulated industries.
- Include non-functional tests: performance at peak concurrency, failure/restart, security and access tests.

## What to ask
Critical tables and reports, tolerance rules, who signs off, business calendar events, available test environments, ability to freeze snapshots for comparison.

## Red flags
- Validation only by row counts.
- Comparing data captured at different times and calling mismatches "timing".
- No owner for sign-off; IT signing on behalf of the business.
- Reconciliation built manually in spreadsheets at the end of the project.
