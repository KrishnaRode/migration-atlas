---
id: bi-modernization
title: BI modernization (Cognos, BusinessObjects, MicroStrategy, Qlik, SSRS → Power BI, Looker, Tableau)
triggers:
  technologies: [cognos, business-objects, microstrategy, qlik, power-bi, looker, tableau, amazon-quicksight, databricks-sql]
  roles: [bi, serving]
  keywords: [bi, reporting, dashboards, cognos, business objects, microstrategy, qlik, ssrs, power bi, looker, tableau, semantic layer, report parity, universe, framework manager]
priority: 5
---

## What you are really migrating
Reports are the visible part. The hard parts are the **semantic layer** (Cognos Framework Manager packages, BO universes, MicroStrategy schema objects/metrics, Qlik load scripts), security (row-level and object-level), scheduling/bursting/distribution, and user habits. Inventory all of them.

## Rationalise first
- Pull usage statistics from the audit/usage database of the source tool. Typically a large share of reports (often 50%+) has not run in a year — retire them.
- Group near-duplicate reports into parameterised ones.
- Classify the rest: operational/pixel-perfect (invoices, regulatory, paginated), interactive dashboards, self-service exploration, and data extracts. Each class has a different target pattern.

## Target heuristics
- **Power BI**: strong fit for Microsoft 365/Azure/Fabric shops; semantic models (DAX), paginated reports cover SSRS/Cognos-style output; capacity licensing considerations.
- **Looker**: centrally governed semantic model in LookML, version-controlled; strong for GCP/BigQuery but works with other warehouses.
- **Tableau**: strong visual exploration; semantic layer via published data sources and Tableau Semantics (verify current capabilities).
- **Platform-native** (Databricks AI/BI dashboards, QuickSight): consider for embedded or cost-sensitive use cases.
- Choose a **single governed semantic layer** wherever possible (Power BI semantic models, LookML, dbt Semantic Layer, platform metric views) so metrics are defined once.

## Conversion reality
- Automated converters exist for some paths (e.g., to Power BI or Tableau) and help with inventory and basic report structure; expect manual rework of complex calculations, prompts/cascading filters, drill paths, bursting and formatting.
- Push business logic down into the warehouse/semantic model instead of recreating it in report-level formulas.
- Live/direct query vs import/extract: decide per model based on data size, freshness and concurrency; direct query on a pay-per-query warehouse can be expensive under dashboard load.

## Report parity and sign-off
- Define parity as numbers matching for agreed filters and periods, not pixel identity.
- Run old and new side by side on the same data snapshot; compare key measures automatically where possible.
- Business owners sign off per report family; use a short parallel period, then switch off the old report to avoid permanent dual running.

## Sequencing
Migrate data platform first for a domain, then repoint or rebuild its reports. Re-pointing legacy BI temporarily to the new warehouse can de-risk the data migration, but check driver support and performance.

## What to ask
Number of reports and active users, usage logs, security model (RLS), distribution/bursting, paginated vs interactive mix, existing licences, embedded analytics needs, and target warehouse.

## Red flags
- Migrating every report one-to-one.
- Metrics defined differently in each dashboard.
- No usage data, so retirement decisions are by opinion.
- Underestimating training and change management for business users.
