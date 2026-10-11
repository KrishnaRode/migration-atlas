---
vendor: Google Cloud
product: Data Validation Tool
title: Data reconciliation during parallel run
url: https://github.com/GoogleCloudPlatform/professional-services-data-validator
doc_type: curated-note
technologies: [reconciliation-framework, google-dvt, great-expectations, dbt, lakehouse-monitoring]
version: null
---

## Purpose

During a parallel run, legacy and target platforms process the same inputs for a period so outputs can be compared before cutover. Reconciliation turns "it looks right" into evidence. The approach below is vendor-neutral; Google's open-source Data Validation Tool (DVT) is one implementation that supports many source/target pairs (check its documentation for supported connectors).

## Reconciliation levels

1. **Object level**: every expected table, view and column exists with compatible types.
2. **Volume level**: row counts per table, partition and business date.
3. **Aggregate level**: sums, min/max, distinct counts and null counts per column, grouped by key dimensions (date, region, product) to localise differences.
4. **Row level**: compare row hashes (normalised concatenation of columns) by primary key to identify missing, extra and changed rows; drill into column-level diffs for mismatches.
5. **Business level**: report/KPI outputs (for example daily revenue, balances) compared with agreed tolerances, signed off by business owners.

## Design considerations

- **Normalisation before hashing**: trim/pad differences, case, NULL vs empty string, timestamp precision and time zones, decimal scale and floating-point rounding must be normalised identically on both sides, or every row will mismatch.
- **Tolerances**: define per-measure tolerances (exact for keys and counts; small absolute or relative tolerance for floating-point aggregates) up front.
- **Timing alignment**: compare data as of the same cut-off; CDC lag and different batch schedules produce false mismatches.
- **Sampling vs full**: full row-level hashing is ideal for critical financial tables; use sampling or partitioned comparison for very large tables.
- **Automation and evidence**: run reconciliation as scheduled jobs, store results in tables, and produce a trend dashboard; auditors and steering committees will ask for evidence.
- **Root-cause categories**: legacy defect, migration defect, expected difference (documented), or timing — track each mismatch to closure.

## Parallel-run cost and duration

Running two platforms concurrently doubles some operational and infrastructure cost. Define exit criteria up front (for example N consecutive business cycles, including a month-end, with zero unexplained differences), and timebox the parallel run.

## Common pitfalls

- Comparing only row counts.
- Reconciling against a moving source.
- Discovering at the end that the legacy system itself has known defects that the new one "fixes", with no agreed policy on which result is correct.
- No ownership for investigating mismatches.
