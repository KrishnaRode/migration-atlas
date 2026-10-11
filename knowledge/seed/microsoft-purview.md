---
vendor: Microsoft
product: Microsoft Purview
title: Microsoft Purview — data governance, catalog and compliance
url: https://learn.microsoft.com/en-us/purview/purview
doc_type: curated-note
technologies: [microsoft-purview, azure, microsoft-fabric, azure-data-factory, azure-synapse, power-bi]
version: null
---

## What it is

Microsoft Purview is a family of data governance, security and compliance solutions. On the governance side it provides a data map (scanning and classifying data sources) and a Unified Catalog for discovery, business glossary, data products and data quality. On the compliance side it covers information protection (sensitivity labels), data loss prevention, insider risk, eDiscovery and audit. The portal and product structure have been reorganised several times; check current documentation for naming.

## Key capabilities

- **Data Map**: scans Azure (ADLS Gen2, Azure SQL, Synapse, Cosmos DB), Microsoft Fabric/Power BI, on-premises (SQL Server, Oracle, Teradata, SAP via self-hosted integration runtime) and other cloud sources; applies built-in and custom classifications.
- **Lineage**: captured from integrated services such as Azure Data Factory and Synapse pipelines, Power BI/Fabric, and others; external tools can push lineage through APIs (Apache Atlas–based).
- **Unified Catalog**: governance domains, data products, glossary terms, owners and stewardship workflows; data quality rules and health views.
- **Sensitivity labels** that flow from Office documents to data assets and Power BI.

## Migration-relevant considerations

- **Governance continuity**: identify which glossary terms, data owners and classifications exist in the legacy estate (spreadsheets, Informatica Axon, Collibra) and plan their import before users lose discoverability.
- **Lineage coverage**: lineage from Databricks or Snowflake into Purview depends on available connectors/integrations (for example via Unity Catalog scanning or OpenLineage-based solutions); test before promising end-to-end lineage.
- **Scanning cost and scope**: scans consume capacity and are billed; scope scans to relevant collections and schedule them sensibly.
- **Access**: Purview governs metadata and policies; actual data access is still enforced by the storage or engine (ADLS ACLs, Unity Catalog, Fabric permissions) unless supported policy enforcement is configured.

## Common pitfalls

- Turning on scans everywhere without ownership, producing a catalog full of uncurated assets.
- Assuming classifications automatically restrict access.
- Self-hosted integration runtime connectivity and credentials for on-premises sources not planned.
- Mixing the classic and new governance experiences without a clear migration plan.
