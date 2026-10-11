---
id: platform-selection
title: Data platform selection (Databricks vs Snowflake vs BigQuery vs Redshift vs Fabric/Synapse)
triggers:
  technologies: [databricks, snowflake, bigquery, amazon-redshift, azure-synapse, microsoft-fabric, databricks-sql]
  roles: [warehouse, lakehouse]
  keywords: [which platform, platform selection, compare, comparison, vs, versus, databricks or snowflake, choose, evaluation, lock-in, best platform, better than, which is better, instead of, alternative to, or snowflake, or bigquery, or databricks, should we use]
match: keywords   # cross-cutting: only fires when the question is about this topic
priority: 7
---

## Ground rule
There is no universally best platform. All five can run enterprise SQL warehousing at scale. The decision is about workload mix, team skills, cloud strategy, ecosystem and operating/cost model. Be suspicious of any analysis that declares a winner without stating those inputs. Product capabilities change quarterly — verify current vendor docs before final claims.

## Decision criteria
- **Workload mix**: SQL BI only vs heavy data engineering vs ML/AI vs streaming vs semi-structured data science.
- **Cloud alignment**: BigQuery is GCP-only; Redshift AWS-only; Fabric/Synapse Azure-centric; Databricks and Snowflake run on all three major clouds.
- **Skills**: SQL analysts and BI teams vs Python/Spark engineers. Retraining cost is real.
- **Ecosystem**: existing Microsoft 365/Power BI estate, Google Workspace/Looker, AWS-native services, SAP, Salesforce.
- **Cost model**: capacity vs consumption, and how predictable the bill must be.
- **Openness/lock-in**: open table formats (Delta/Iceberg) and open catalogs vs proprietary storage.
- **Governance**: fit with the enterprise catalog, IAM and data residency needs.

## Honest profiles
- **Databricks**: strongest when data engineering, ML/AI and streaming dominate alongside SQL; Spark/Python skills help; open formats (Delta, Iceberg via UniForm/managed Iceberg — verify); Unity Catalog for governance. Requires more platform engineering choices than pure SaaS warehouses, though serverless options reduce this.
- **Snowflake**: strongest for SQL-centric warehousing with minimal administration, multi-cloud, data sharing/marketplace; growing Python (Snowpark) and Iceberg support. Credit consumption needs governance (warehouse sizing, auto-suspend).
- **BigQuery**: serverless, strong for large scan analytics and GCP-native integration (Dataflow, Vertex AI, Looker). On-demand (bytes scanned) vs capacity (slot editions) pricing — choose deliberately.
- **Amazon Redshift**: good fit for AWS-committed shops, provisioned RA3 or Serverless; integrates with S3/Glue/Lake Formation. Concurrency and maintenance have improved; verify current feature set.
- **Microsoft Fabric**: SaaS bundle (OneLake, warehouse, Spark, Power BI) on capacity pricing; attractive for Power BI-centric Microsoft shops. Evaluate maturity of the specific workloads you need. Synapse dedicated pools are being superseded by Fabric for new builds — verify Microsoft's current guidance.

## How to run a fair evaluation
1. Write 5–10 representative workloads from real query logs and pipelines, with data volumes and concurrency.
2. Run a time-boxed proof of concept on 2–3 shortlisted platforms with vendor tuning help for each (equal effort).
3. Measure performance, cost per workload under realistic concurrency, developer productivity and governance fit.
4. Model 3-year TCO including migration, people, training and exit cost — not list price alone.

## Hybrid is normal
Many enterprises run two platforms (e.g., lakehouse for engineering/ML plus a warehouse or Power BI semantic layer for BI). Accept this only with a clear system-of-record per domain and shared governance; otherwise you duplicate data and cost.

## What to ask
Primary cloud, workload mix percentages, team skills, BI tool, existing enterprise agreements/commits, latency and concurrency needs, regulatory constraints.

## Red flags
- Decision made from benchmarks published by a vendor.
- POC on toy data or single-user queries.
- Ignoring existing cloud commits and enterprise agreements.
- Choosing two platforms "to avoid lock-in" without the team to run both.
