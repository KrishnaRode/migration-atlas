---
vendor: Google Cloud
product: Cloud Storage
title: Cloud Storage — object storage foundation for data lakes on Google Cloud
url: https://cloud.google.com/storage/docs/introduction
doc_type: curated-note
technologies: [google-cloud-storage, gcp, landing-zone, raw-layer, bigquery, apache-iceberg]
version: null
---

## What it is

Cloud Storage (GCS) is Google Cloud's object storage service. Data is stored as objects in buckets with a flat namespace (folder-like prefixes are a naming convention, though hierarchical namespace buckets are available for file-system-style workloads). It is the usual landing zone and lake storage for analytics on Google Cloud.

## Key capabilities

- **Location types**: regional, dual-region and multi-region buckets, affecting availability, latency, cost and data residency.
- **Storage classes**: Standard, Nearline, Coldline and Archive, with minimum storage durations and retrieval charges for colder classes; Autoclass can move objects automatically.
- **Consistency**: strong global consistency for object reads after writes, overwrites and deletes, and for listing operations.
- **Data protection**: object versioning, soft delete (enabled by default with a retention window), retention policies and bucket lock for WORM requirements, CMEK.
- **Access control**: IAM with uniform bucket-level access (recommended over legacy ACLs), signed URLs, VPC Service Controls perimeters.
- **Data movement**: Storage Transfer Service (from other clouds, HTTP sources, on-premises file systems via agents) and Transfer Appliance for very large offline transfers; gcloud storage CLI for ad hoc copies.

## Migration-relevant considerations

- **Bulk transfer planning**: estimate transfer time from available bandwidth (for example, 100 TB over a dedicated 10 Gbps link takes on the order of a day or more at realistic utilisation). Choose online transfer, Interconnect, or Transfer Appliance accordingly.
- **Layout**: separate buckets (or at least prefixes) for landing, raw/bronze and curated data, with lifecycle rules per zone. Bucket names are global and cannot be renamed.
- **Open table formats**: BigQuery can query Iceberg tables and external data in GCS (BigLake); Databricks and Dataproc read the same buckets. Decide which engine owns writes to avoid conflicting metadata.
- **Residency**: choose bucket locations aligned with regulatory requirements before data lands; moving data later means copying it.

## Common pitfalls

- Millions of tiny objects, which slow listing and downstream processing.
- Sequential object naming patterns at very high request rates, which can create hotspots during ramp-up.
- Using Archive or Coldline for data that is read frequently, incurring retrieval and early-deletion charges.
- Granting `allUsers` or overly broad roles on buckets.
