---
vendor: Google Cloud
product: Dataplex
title: Dataplex — data governance, catalog and quality on Google Cloud
url: https://cloud.google.com/dataplex/docs/introduction
doc_type: curated-note
technologies: [google-dataplex, gcp, bigquery, google-cloud-storage]
version: null
---

## What it is

Dataplex is Google Cloud's data governance and management service. It brings together metadata cataloging and search, data profiling and quality, lineage, and logical organisation of data across BigQuery, Cloud Storage and other sources. Google has consolidated its earlier Data Catalog capabilities into Dataplex (now branded Dataplex Universal Catalog); product names and feature boundaries have shifted, so check current documentation.

## Key capabilities

- **Catalog**: automatic metadata harvesting for BigQuery, Cloud Storage, Pub/Sub, Spanner, Vertex AI and others, plus custom entries for third-party systems; business glossaries and aspect (metadata) types for enrichment; search across projects.
- **Data profiling and data quality**: scheduled scans that compute column statistics and evaluate rules (null checks, ranges, uniqueness, regex, SQL rules), publishing results to BigQuery and the console.
- **Lineage**: automatic lineage for BigQuery jobs and several Google services, with an API (OpenLineage-compatible) to report lineage from external tools.
- **Lakes, zones and assets**: a logical organisation layer that groups buckets and datasets by domain and raw/curated zones.
- **Integration with IAM** and policy tags for column-level security in BigQuery.

## Migration-relevant considerations

- **Governance parity**: legacy platforms often have lineage and glossary content in tools such as Informatica EDC/Axon, Collibra or Alation. Decide whether Dataplex replaces them or whether those tools remain the enterprise catalog with Dataplex as a technical catalog feeding them.
- **Lineage gaps**: lineage is captured automatically only for supported services. Processing in Databricks, Dataproc or external tools needs OpenLineage reporting or will show as gaps.
- **Quality as a migration gate**: Dataplex data quality scans can codify reconciliation and acceptance rules for migrated tables during parallel run.
- **Policy tags**: column-level security via policy tags should be designed before loading sensitive data.

## Common pitfalls

- Assuming the catalog is useful without curation; ownership, descriptions and glossary links still need stewardship.
- Building on the older lakes/zones model without confirming it fits the current product direction.
- Running frequent full-table quality scans on very large tables without sampling or incremental filters, driving cost.
