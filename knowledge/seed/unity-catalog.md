---
vendor: Databricks
product: Unity Catalog
title: Unity Catalog — governance for the lakehouse
url: https://docs.databricks.com/aws/en/data-governance/unity-catalog/
doc_type: curated-note
technologies: [unity-catalog, databricks, delta-lake]
version: null
---

## What it is

Unity Catalog (UC) is the governance layer of the Databricks platform. It provides a single place to define access control, auditing, lineage and discovery for data and AI assets across the workspaces attached to a regional metastore. A core version of Unity Catalog was also released as an open-source project; feature parity between the managed and open-source editions differs, so check current documentation.

## Key capabilities

- **Three-level namespace**: `catalog.schema.object`, where objects include tables, views, materialized views, volumes (governed non-tabular files), functions and registered models.
- **Managed vs external tables**: managed tables live in UC-managed storage and their lifecycle is controlled by UC; external tables point to paths registered through *external locations* backed by *storage credentials*.
- **Fine-grained security**: ANSI-style GRANT/REVOKE on securables, row filters and column masks, and tag-driven policies (attribute-based controls are evolving; check current documentation for GA status).
- **Lineage and audit**: table- and column-level lineage captured automatically for workloads running on UC-enabled compute; audit and usage data exposed through system tables.
- **Sharing and federation**: Delta Sharing for cross-organisation sharing, and Lakehouse Federation to query external databases and catalogs (including legacy Hive metastores) through UC.

## Migration-relevant considerations

- **Hive metastore upgrade**: workspaces that predate UC usually hold tables in the per-workspace Hive metastore. Plan an inventory, decide managed vs external per table, and use Databricks tooling (for example the UCX project from Databricks Labs) or `SYNC`/`CREATE TABLE CLONE` patterns. Code that references two-level names (`schema.table`) must be updated or given a default catalog.
- **Compute access modes**: UC enforcement depends on compute configured with a supported access mode (standard/shared or dedicated/single-user) or serverless. Legacy cluster configurations, init scripts and direct cloud-storage credentials in notebooks often need rework.
- **Catalog design**: decide early whether catalogs map to environments (dev/test/prod), business domains, or medallion layers. Changing this later is disruptive because names are embedded in jobs, dashboards and BI connections.
- **Identity**: groups should be account-level and ideally synced from the enterprise IdP (for example SCIM from Microsoft Entra ID); workspace-local groups do not participate in UC grants.

## Common pitfalls

- Overlapping external locations or registering storage paths that are also used outside UC, which undermines governance and can block table creation.
- Granting directly to users instead of groups, producing unmanageable permission sprawl.
- Assuming lineage covers every engine; external tools writing directly to storage do not appear in UC lineage.
- Forgetting `USE CATALOG` / `USE SCHEMA` privileges in addition to `SELECT`, which produces confusing access errors during cutover testing.
