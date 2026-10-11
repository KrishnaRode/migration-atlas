---
vendor: Microsoft
product: Azure Data Factory
title: Azure Data Factory — cloud data integration and orchestration
url: https://learn.microsoft.com/en-us/azure/data-factory/introduction
doc_type: curated-note
technologies: [azure-data-factory, azure, ssis, adls-gen2, microsoft-fabric, informatica-powercenter]
version: null
---

## What it is

Azure Data Factory (ADF) is Azure's managed data integration service for building pipelines that move and transform data across cloud and on-premises sources. The same engine underpins Synapse pipelines, and Microsoft Fabric includes Data Factory capabilities with a related but distinct feature set (check current documentation for parity).

## Key capabilities

- **Building blocks**: *pipelines* (workflows) composed of *activities* (Copy, Data Flow, Lookup, ForEach, If, Execute Pipeline, Web, stored procedure, Databricks notebook/job, and more), *datasets*, *linked services* (connections) and *triggers* (schedule, tumbling window, storage event, custom event).
- **Integration runtimes**: Azure IR (managed), self-hosted IR (installed on-premises or in a VNet to reach private sources), and Azure-SSIS IR to run existing SSIS packages in the cloud.
- **Copy activity** with a wide connector catalogue and parallel copy settings; **mapping data flows** provide visual Spark-based transformations.
- **Operations**: monitoring views, alerts via Azure Monitor, Git integration (Azure Repos/GitHub) and ARM/Bicep-based CI/CD.
- **Security**: managed identities, Azure Key Vault-referenced secrets, managed VNet and private endpoints.

## Migration-relevant considerations

- **SSIS lift-and-shift**: the Azure-SSIS IR allows packages to run with minimal change as a stepping stone; modernisation to pipelines, data flows or Databricks can follow.
- **From Informatica and other ETL**: ADF is strongest at orchestration and data movement. Complex transformations are often delegated to Databricks, Synapse/Fabric SQL or dbt, with ADF calling them.
- **Hybrid connectivity**: plan self-hosted IR high availability (multiple nodes), firewall rules, and throughput for large on-premises extracts.
- **Fabric direction**: for new Fabric-centred estates, evaluate Fabric Data Factory versus ADF; migration tooling between them exists but is not one-to-one.

## Common pitfalls

- Hardcoded connection strings instead of Key Vault references and parameters.
- Very fine-grained pipelines with many activity runs, increasing cost and making monitoring noisy.
- A single self-hosted IR node becoming a bottleneck or single point of failure.
- Using mapping data flows for small jobs where Spark cluster start-up dominates runtime.
