---
id: cost-and-finops
title: Cost and FinOps for migrations (licence exit, consumption traps, egress, sizing, commitments)
triggers:
  technologies: [databricks, snowflake, bigquery, amazon-redshift, azure-synapse, microsoft-fabric, teradata, oracle-database, oracle-exadata, cloudera-hadoop, informatica-powercenter]
  roles: [warehouse, lakehouse, legacy-warehouse, cloud-platform]
  keywords: [cost, finops, tco, pricing, licence, license, budget, egress, reserved, commitment, savings, consumption, dbu, credits, slots, cheaper, expensive, business case]
match: keywords   # cross-cutting: only fires when the question is about this topic
priority: 5
---

## Never fabricate prices
Pricing changes often and varies by region, edition, contract and discount. Give structure and drivers, and tell the user to price with current vendor calculators and their negotiated rates.

## Build the TCO honestly
- **Current state**: licences and support (often the biggest line), hardware refresh avoided, data centre, operations staff, third-party tools tied to the platform.
- **Target run cost**: compute, storage, networking/egress, managed services, tooling, support plans, monitoring.
- **Migration cost** (one-off): partners, conversion tools, dual running, training, parallel licences.
- **People**: new skills, platform team, FinOps function.
- Show a timeline: costs usually rise during dual running before falling. Savings depend on actually decommissioning legacy.

## Licence exit timing
Map every contract end date (Teradata, Oracle, Cloudera, Informatica, mainframe software). The cutover plan should finish before renewal, or negotiate short extensions early. Missing a renewal by weeks can cost a full year.

## Consumption pricing traps
- Idle compute: warehouses/clusters left running; enforce auto-suspend/auto-terminate and serverless where appropriate.
- Scan-based pricing (e.g., on-demand BigQuery, Athena): `SELECT *`, missing partition filters and BI tools in direct-query mode multiply cost. Use partitioning/clustering, quotas, or capacity pricing.
- Oversized compute "to be safe"; right-size from measured workload.
- Dashboard refresh storms and unbounded ad-hoc access.
- Streaming jobs running 24x7 when hourly freshness is enough.
- Storage growth from time travel, snapshots, multiple copies across layers and environments.
- Small-file overhead and excessive metadata operations.

## Egress and network
Cross-region and internet egress, cross-cloud data movement, and NAT gateway processing charges are frequent surprises. Keep compute next to data; avoid cross-cloud reads for hot paths; check private connectivity port and data transfer pricing.

## Commitments
Reserved instances, savings plans, committed-use discounts, prepaid credits/DBU commits and capacity reservations reduce unit cost but create lock-in to a forecast. Commit only after 2–3 months of measured steady-state usage; start partial, then ratchet up.

## FinOps practice
- Mandatory tagging (cost centre, project, environment, owner) enforced by policy.
- Per-team budgets and alerts; showback then chargeback.
- Platform system tables/billing exports into a cost dashboard.
- Regular reviews of top-spending queries, jobs and warehouses.
- Unit economics: cost per pipeline run, per report, per business transaction.

## What to ask
Current licence and support costs and end dates, existing cloud commits, workload utilisation profile, growth forecast, and who owns cost accountability.

## Red flags
- Business case comparing on-prem total cost to cloud list compute only.
- Savings booked without a decommission plan.
- No tagging or budgets in the landing zone.
- Committing multi-year spend before migration volumes are known.
