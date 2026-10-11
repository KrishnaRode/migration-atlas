---
vendor: Google Cloud
product: Cloud Monitoring
title: Cloud Monitoring — metrics, dashboards and alerting on Google Cloud
url: https://cloud.google.com/monitoring/docs/monitoring-overview
doc_type: curated-note
technologies: [google-cloud-monitoring, google-cloud-logging, gcp, prometheus, opentelemetry, grafana]
version: null
---

## What it is

Cloud Monitoring is part of Google Cloud Observability. It collects metrics from Google Cloud services, applications and agents, and provides dashboards, alerting, uptime checks and service-level objective (SLO) monitoring. It works alongside Cloud Logging, Cloud Trace and Error Reporting.

## Key capabilities

- **Metrics**: thousands of built-in metrics for Google Cloud services (BigQuery, Dataflow, Pub/Sub, Datastream, Composer, GKE, etc.), agent metrics from VMs via the Ops Agent, custom metrics, and log-based metrics derived from log entries.
- **Prometheus compatibility**: Google Cloud Managed Service for Prometheus stores Prometheus metrics, and PromQL can be used for queries and alerting; Google has been steering users from the older Monitoring Query Language toward PromQL — check current documentation.
- **Alerting**: alerting policies on metric thresholds, absence, or log matches, with notification channels such as email, SMS, PagerDuty, Slack, webhooks and Pub/Sub.
- **Metrics scopes**: a single scoping project can view metrics from many projects, supporting central operations teams.
- **SLOs and uptime checks** for services and endpoints.
- **OpenTelemetry** collection paths for application telemetry.

## Migration-relevant considerations

- **Operational readiness**: legacy platforms often have mature monitoring (Control-M alerts, Teradata Viewpoint, Oracle Enterprise Manager). Define equivalent signals for the target before cutover: pipeline freshness, CDC lag, job failures, slot/warehouse utilisation, cost anomalies.
- **Data-pipeline SLIs**: monitor end-to-end freshness (latest committed record time) and completeness, not only infrastructure health. Datastream latency, Pub/Sub oldest unacked message age and Dataflow system lag are common signals.
- **Multi-platform**: if Databricks, Snowflake or on-premises systems remain in scope, decide whether Cloud Monitoring is the single pane or whether an existing tool such as Datadog or Grafana aggregates everything.
- **Alert routing** must match the new support model (who is on call for which layer).

## Common pitfalls

- Alert fatigue from many low-value threshold alerts; start from SLOs and user-visible symptoms.
- High-cardinality custom metrics driving cost.
- Not monitoring the monitoring: missing-data conditions for pipelines that silently stop.
