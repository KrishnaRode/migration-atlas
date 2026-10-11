---
vendor: Microsoft
product: Azure Data Lake Storage Gen2
title: ADLS Gen2 — hierarchical-namespace data lake storage on Azure
url: https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction
doc_type: curated-note
technologies: [adls-gen2, azure, microsoft-entra-id, databricks, azure-synapse, microsoft-fabric]
version: null
---

## What it is

Azure Data Lake Storage Gen2 is a set of capabilities on Azure Blob Storage, enabled by turning on the *hierarchical namespace* (HNS) for a storage account. HNS adds real directories with atomic rename and delete, and POSIX-like access control lists, making Blob Storage suitable for analytics engines such as Databricks, Synapse, HDInsight and Fabric shortcuts.

## Key capabilities

- **Hierarchical namespace**: directory operations are metadata operations rather than object-by-object copies, which helps Spark commit protocols and large reorganisations.
- **Access control**: Azure RBAC at account/container level combined with POSIX ACLs on directories and files; Microsoft Entra ID identities, managed identities and service principals.
- **ABFS driver**: Hadoop-compatible access via `abfss://container@account.dfs.core.windows.net/path`.
- **Blob features**: access tiers (hot, cool, cold, archive), lifecycle management, soft delete, immutable storage, customer-managed keys, private endpoints. Some Blob features have limitations on HNS accounts — check current documentation.

## Migration-relevant considerations

- **From HDFS / Hadoop**: ADLS Gen2 is the usual target for Cloudera/HDP migrations; directory semantics and ACL concepts carry over, but owners, groups and permissions must be mapped from Kerberos/LDAP principals to Entra ID objects.
- **Data movement**: AzCopy, Azure Data Factory, Data Box for offline transfer, and partner tools for large HDFS migrations with ongoing sync.
- **Governance layer**: when using Databricks, Unity Catalog external locations should be the access path; direct storage keys or SAS tokens in notebooks undermine governance.
- **Account layout**: separate storage accounts by environment and sensitivity; consider account-level scalability targets for very high throughput.

## Common pitfalls

- Creating a storage account without HNS and discovering later that tools require it; enabling HNS on an existing account is a one-way upgrade with prerequisites.
- ACLs not inherited as expected: default ACLs apply only to newly created children, not existing ones.
- Using account keys or long-lived SAS tokens instead of identities.
- Lifecycle rules archiving data still needed by pipelines.
