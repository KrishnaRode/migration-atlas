---
vendor: Databricks
product: Lakeflow Jobs (Databricks Workflows)
title: Databricks Workflows / Lakeflow Jobs — orchestration on Databricks
url: https://docs.databricks.com/aws/en/jobs/
doc_type: curated-note
technologies: [databricks-workflows, databricks, control-m, apache-airflow]
version: null
---

## What it is

Databricks Jobs — marketed for some time as Databricks Workflows and more recently under the Lakeflow Jobs name — is the native orchestrator for running data, analytics and ML workloads on Databricks. Naming has changed more than once, so check current documentation for terminology.

## Key capabilities

- **Multi-task DAGs**: a job contains tasks with dependencies. Task types include notebooks, Python scripts and wheels, JARs, SQL (queries, files, dashboards, alerts), dbt, pipelines (Lakeflow Declarative Pipelines), and *run job* tasks for modular composition.
- **Control flow**: conditional *if/else* tasks, *run if* dependency rules (for example run when all succeeded / at least one failed), and *for each* loops over parameter lists.
- **Triggers**: cron-style schedules, file-arrival triggers on cloud storage, table-update triggers, and continuous jobs; jobs can also be started via REST API or CLI from an external scheduler.
- **Compute**: serverless jobs compute or classic job clusters (ephemeral, per run) and shared job clusters across tasks.
- **Operations**: retries, timeouts, notifications (email, webhooks, Slack/Teams), *repair run* to rerun only failed tasks, run history, and system tables for job cost and run analysis.
- **As code**: jobs are typically defined in Databricks Asset Bundles or Terraform rather than by hand in the UI.

## Migration-relevant considerations

- **From enterprise schedulers** (Control-M, AutoSys, Tidal): map folders/boxes to jobs, job dependencies to task dependencies, and resource/quantitative limits to concurrency settings. Cross-job and cross-platform dependencies, calendars (business days, holidays) and file watchers need explicit design; Databricks scheduling is cron-based and has no rich calendar object.
- **Hybrid orchestration**: many enterprises keep an enterprise scheduler or Airflow as the top-level orchestrator and call Databricks jobs through operators or APIs. Decide which tool owns SLAs and alerting.
- **Granularity**: avoid one job per legacy script; group related tasks to reduce scheduling overhead and improve lineage readability.

## Common pitfalls

- Using all-purpose (interactive) clusters for production jobs, which costs more and hurts isolation.
- Embedding environment-specific paths and secrets in notebooks instead of job parameters and secret scopes.
- Ignoring maximum concurrent runs, leading to overlapping runs of the same job.
- Losing operational context (run books, owner, escalation) when moving away from a mature scheduler.
