---
vendor: Databricks
product: Databricks SQL
title: Databricks SQL warehouses — serving BI and SQL workloads
url: https://docs.databricks.com/aws/en/compute/sql-warehouse/
doc_type: curated-note
technologies: [databricks-sql, databricks, tableau, power-bi, looker]
version: null
---

## What it is

A SQL warehouse is the compute resource Databricks provides for SQL analytics, BI tools and dashboards. It queries Delta and other tables governed by Unity Catalog and is the usual migration target for workloads that previously ran on Teradata, Netezza, Oracle or other warehouses.

## Key capabilities

- **Warehouse types**: *serverless* (fast start, compute managed by Databricks), *pro* and *classic* (compute in the customer's cloud account). Feature availability differs by type and region; check current documentation.
- **Sizing and scaling**: t-shirt sizes control per-cluster capacity; min/max cluster counts let a warehouse scale out for concurrency. Auto-stop shuts idle warehouses down.
- **Performance features**: the Photon vectorised engine, result caching, predictive I/O and intelligent workload management (on serverless).
- **Connectivity**: JDBC/ODBC drivers and partner connectors for Tableau, Power BI, Looker and others; SQL editor, dashboards and alerts in the workspace; SQL Statement Execution API.
- **Observability**: query history, query profiles and system tables for cost and performance analysis.

## Migration-relevant considerations

- **Dialect**: Databricks SQL is ANSI-oriented Spark SQL. Teradata, Oracle and T-SQL constructs (procedural code, proprietary date arithmetic, `QUALIFY` behaviour nuances, implicit casts, case sensitivity) need translation; automated converters help but always require testing. Procedural SQL support (SQL scripting, stored procedures) has been expanding — check current documentation before assuming parity.
- **Workload isolation**: separate warehouses for ETL-style SQL, interactive BI and data science avoid noisy-neighbour issues and make cost attribution clear.
- **Concurrency testing**: legacy MPP appliances often handled high concurrency through workload management rules; replicate peak concurrency in performance tests and size max clusters accordingly.
- **BI repointing**: update connection strings, catalog/schema references and authentication (OAuth or personal access tokens / service principals) in every published data source.

## Common pitfalls

- Oversizing a single warehouse instead of scaling out clusters for concurrency.
- Disabling auto-stop "to avoid cold starts", leading to cost overrun; serverless largely removes the cold-start concern.
- Comparing legacy and new performance on cold caches or on un-optimised tables (no clustering, small files).
- Ignoring numeric and NULL-handling differences that change report totals.
