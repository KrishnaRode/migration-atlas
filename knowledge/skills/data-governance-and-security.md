---
id: data-governance-and-security
title: Data governance and security (catalog, lineage, access, PII, residency)
triggers:
  technologies: [unity-catalog, google-dataplex, microsoft-purview, collibra, alation, aws-lake-formation, aws-glue-data-catalog, snowflake-horizon, aws-kms, google-cloud-kms, azure-key-vault, hashicorp-vault, aws-secrets-manager, google-secret-manager, vpc-service-controls]
  roles: [governance, security, data-quality]
  keywords: [governance, lineage, catalog, pii, gdpr, hipaa, pci, residency, sovereignty, masking, row level security, encryption, access control, compliance, regulated, audit, classification]
priority: 6
---

## Principle
Governance must be designed in during migration, not bolted on after. A migration is the cheapest moment to classify data, fix access models and capture lineage, because every table is being touched anyway.

## Layers of control
- **Catalog and classification**: one technical catalog enforcing access (Unity Catalog, Lake Formation, Dataplex/BigLake, Snowflake Horizon, Purview for Fabric) plus, optionally, an enterprise business catalog (Collibra, Alation, Purview) for glossary, ownership and stewardship. Avoid two systems both trying to enforce permissions.
- **Access model**: attribute- or role-based access on groups synced from the IdP; least privilege; separate read/write/admin roles per domain. Column masking and row filters for PII and entitlements; dynamic views where native policies are missing.
- **Lineage**: prefer platform-native automatic lineage (column-level where available) and OpenLineage-compatible pipelines; legacy lineage from ETL tools is valuable as a migration map.
- **Encryption**: at rest by default on all clouds; customer-managed keys when policy requires (understand the operational risk of key deletion). TLS in transit, including private connectivity.
- **Network**: private endpoints and exfiltration controls for sensitive workloads.
- **Secrets**: central secrets manager; no credentials in notebooks, DAG code or config files.
- **Audit**: platform audit logs exported to central SIEM with retention matching regulation.

## Regulated industries
- **Financial services**: model risk, SOX controls over financial reporting pipelines, data lineage for regulatory reports (e.g., BCBS 239 principles), segregation of duties in deployment.
- **Healthcare**: HIPAA (US) — BAA with cloud and SaaS vendors, PHI minimisation, de-identification.
- **Payments**: PCI DSS — keep cardholder data out of the analytics platform where possible; tokenise.
- **Privacy laws** (GDPR, CCPA/CPRA, DPDP, etc.): lawful basis, purpose limitation, right to erasure (design delete propagation through bronze/silver/gold and time-travel retention), cross-border transfer rules.
- Residency: pin storage and compute regions; check that managed services (including AI features and support access) honour the region. Verify current vendor documentation.

## Migration approach
1. Classify sources (automated scanners + steward confirmation) before moving data.
2. Decide per class: migrate as-is, mask/tokenise at ingest, or exclude.
3. Recreate entitlements from source systems, but rationalise — legacy grants are usually over-broad.
4. Establish data owners and stewards per domain; tie to the operating model.
5. Add quality rules and contracts at silver/gold boundaries.

## What to ask
Regulations in scope, residency constraints, PII/PHI/PCI presence, IdP and group structure, existing catalog tools, audit requirements, and who owns data access approvals.

## Red flags
- Copying production PII into dev/test environments.
- Service principals with admin rights used by pipelines.
- Access granted to individuals, not groups.
- "We will classify after go-live."
- Two catalogs with overlapping enforcement and no source of truth.
