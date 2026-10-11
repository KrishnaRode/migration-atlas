---
vendor: Google Cloud
product: Secret Manager
title: Secret Manager — storing credentials and keys on Google Cloud
url: https://cloud.google.com/secret-manager/docs/overview
doc_type: curated-note
technologies: [google-secret-manager, gcp, google-iam, google-cloud-kms, cloud-composer]
version: null
---

## What it is

Secret Manager is Google Cloud's managed service for storing API keys, passwords, certificates and other sensitive configuration. Secrets are versioned, access-controlled with IAM, encrypted at rest, and audited through Cloud Audit Logs.

## Key capabilities

- **Secrets and versions**: a secret is a named container; each value is an immutable *version* that can be enabled, disabled or destroyed. Clients read a specific version or the `latest` alias.
- **Replication**: global secrets with automatic or user-managed replication across regions, and regional secrets when data residency requires the value to stay in one location.
- **Encryption**: Google-managed encryption by default, with customer-managed encryption keys (CMEK) via Cloud KMS.
- **Rotation support**: rotation schedules publish notifications to Pub/Sub; the actual rotation logic (for example a Cloud Run function that updates a database password and adds a new version) is customer-implemented.
- **Integrations**: native references from Cloud Run, Cloud Functions, GKE (via the Secret Manager CSI driver/add-on), Cloud Build, and Cloud Composer as an Airflow secrets backend.

## Migration-relevant considerations

- **Inventory credentials early**: legacy ETL tools, schedulers and scripts often embed passwords in parameter files, connection objects or JCL. Each must be identified, moved to Secret Manager, and referenced by name.
- **Service identity over secrets**: where possible, replace stored credentials with workload identity and service-account IAM (for example BigQuery or Cloud Storage access needs no stored key). Avoid exporting service-account keys.
- **Least privilege**: grant `secretAccessor` on individual secrets to the specific service accounts that need them, not project-wide.
- **Cross-platform**: Databricks on Google Cloud uses its own secret scopes; decide whether to mirror secrets or have jobs read Secret Manager directly.

## Common pitfalls

- Pinning applications to `latest` without a rollback plan when a bad version is added.
- Granting broad roles (Owner/Editor) that implicitly allow secret access.
- Storing large configuration blobs; secrets have a size limit (64 KiB per version).
- Forgetting that destroyed versions cannot be recovered.
