---
vendor: Microsoft
product: Azure Synapse Analytics and Microsoft Fabric
title: Azure Synapse Analytics and Microsoft Fabric — Microsoft's analytics platforms
url: https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview
doc_type: curated-note
technologies: [azure-synapse, microsoft-fabric, azure, power-bi, adls-gen2, delta-lake, sql-server]
version: null
---

## What they are

**Azure Synapse Analytics** is a PaaS analytics service combining dedicated SQL pools (the evolution of Azure SQL Data Warehouse), serverless SQL pools over the lake, Apache Spark pools and Synapse pipelines. **Microsoft Fabric** is Microsoft's newer SaaS analytics platform that unifies data engineering, warehousing, real-time analytics, data science and Power BI on a single lake, OneLake. Microsoft positions Fabric as the strategic direction for new analytics investments and provides migration guidance from Synapse; check current documentation for roadmap statements.

## Key capabilities

- **Synapse dedicated SQL pools**: MPP engine with 60 distributions; tables distributed by hash, round-robin or replicated; clustered columnstore indexes; scaled in DWUs and pausable.
- **Synapse serverless SQL**: pay-per-query T-SQL over Parquet, CSV and Delta files in ADLS Gen2.
- **Fabric OneLake**: a tenant-wide logical lake storing tables in Delta Parquet format, with *shortcuts* to ADLS Gen2, S3, GCS and other sources without copying.
- **Fabric workloads**: Lakehouse (Spark + SQL analytics endpoint), Warehouse (T-SQL with transactions over Delta), Data Factory, Real-Time Intelligence, Data Science and Power BI (including Direct Lake mode).
- **Capacity model**: Fabric is billed by capacity (F SKUs) shared across workloads, with smoothing and throttling behaviour.

## Migration-relevant considerations

- **From SQL Server/Synapse dedicated pools**: T-SQL familiarity carries over, but Fabric Warehouse supports a subset of T-SQL surface area and data types; review unsupported features (for example certain DDL, identity behaviours, and data types) before conversion.
- **From Teradata/Netezza/Oracle**: plan dialect translation and redesign of distribution/indexing strategies; Fabric relies on automatic optimisation rather than distribution keys.
- **Power BI estates**: Fabric integrates tightly with existing Power BI workspaces and licences; this is often a major factor in platform choice.
- **Capacity planning**: concurrent workloads on one capacity can throttle each other; separate capacities for production and development.

## Common pitfalls

- Treating Fabric as a drop-in replacement for dedicated SQL pools without testing T-SQL compatibility.
- Ignoring capacity throttling during peak loads.
- Unmanaged sprawl of workspaces and items without governance.
