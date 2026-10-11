---
vendor: Databricks
product: Lakeflow Connect
title: Lakeflow Connect — managed ingestion connectors for Databricks
url: https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/
doc_type: curated-note
technologies: [lakeflow-connect, databricks, unity-catalog, salesforce, sql-server]
version: null
---

## What it is

Lakeflow Connect is the Databricks family of ingestion capabilities for bringing data from enterprise applications, databases, files and message systems into Unity Catalog tables. It sits alongside Lakeflow Declarative Pipelines (transformation) and Lakeflow Jobs (orchestration) under the Lakeflow brand. Connector coverage, naming and GA status change frequently — always check current documentation before committing to a design.

## Key capabilities

- **Managed connectors**: fully managed, UI/API-configured connectors for SaaS applications (examples have included Salesforce, Workday, ServiceNow, Google Analytics and SharePoint) and for databases (for example SQL Server), producing streaming tables governed by Unity Catalog.
- **Database CDC pattern**: database connectors typically use an *ingestion gateway* that reads change data (for example change tracking or CDC on SQL Server) into a staging location, and an *ingestion pipeline* that applies changes to target tables incrementally.
- **Standard connectors**: lower-level building blocks such as Auto Loader for cloud object storage, and readers for Kafka-compatible sources, used inside pipelines you author yourself.
- **Serverless execution and UC integration**: pipelines usually run on serverless compute; targets, lineage and permissions live in Unity Catalog.

## Migration-relevant considerations

- **Fit-gap first**: compare each source system against the current supported-source list, supported object types, and documented limitations (DDL handling, primary-key requirements, supported data types, maximum tables per pipeline).
- **Source-side prerequisites**: database CDC usually requires enabling CDC/change tracking, specific permissions, and network connectivity from Databricks to the source (private connectivity for on-premises databases). Agree these with DBAs early; they are frequent schedule blockers.
- **Alternative paths**: where a managed connector does not exist, common alternatives are partner tools (for example Qlik Replicate, Fivetran, Striim), Debezium into Kafka, or cloud-native CDC (AWS DMS, Google Datastream) landing files that Auto Loader picks up.
- **History and SCD**: decide whether the target should be SCD Type 1 (current state) or Type 2 (history) and confirm the connector supports the required mode.

## Common pitfalls

- Treating a connector as a full replication tool: soft deletes, schema changes and very wide tables can behave differently from a dedicated CDC product.
- Underestimating initial snapshot time and source load for large tables.
- Not budgeting for serverless and gateway compute costs that run continuously.
- Skipping reconciliation; validate counts and key aggregates between source and target before decommissioning legacy feeds.
