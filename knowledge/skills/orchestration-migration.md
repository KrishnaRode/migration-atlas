---
id: orchestration-migration
title: Orchestration migration (Control-M, AutoSys, Tidal, cron, JCL → modern orchestrators)
triggers:
  technologies: [control-m, autosys, tidal, cron, jcl, apache-airflow, cloud-composer, amazon-mwaa, databricks-workflows, aws-step-functions, google-cloud-scheduler, azure-data-factory]
  roles: [orchestrator]
  keywords: [scheduler, orchestration, control-m, autosys, tidal, cron, jcl, airflow, dag, workflow, job dependencies, batch window, calendars, dagster, step functions]
priority: 5
---

## What enterprise schedulers actually do
Control-M, AutoSys and Tidal are not just cron. They provide calendars (business days, holidays, fiscal periods), cross-application dependencies, file watchers, resource/quantitative locks, agent-based execution on many hosts, SLA alerting, operator consoles, and audit. A migration must account for every one of these, or operations teams will reject the new platform.

## Target heuristics
- **Apache Airflow** (self-managed, Cloud Composer, Amazon MWAA, Astronomer): general-purpose, Python DAGs, huge operator ecosystem; best when orchestrating across many systems. Needs engineering discipline (DAG code review, testing, version pinning).
- **Databricks Workflows (Jobs)**: best when most tasks run on Databricks; native retries, task values, file-arrival and table triggers; less suited to orchestrating arbitrary external systems.
- **AWS Step Functions**: event-driven, serverless state machines on AWS; good for service orchestration, less natural for large calendar-driven batch estates.
- **Azure Data Factory / Fabric pipelines**: good for Azure-centric data pipelines with visual authoring.
- **Dagster/Prefect**: asset-oriented or Pythonic orchestration; good for data-product-centric teams.
- **Keep the enterprise scheduler** (possibly its SaaS edition) and have it trigger cloud jobs when the estate spans mainframe, ERP and many non-data workloads. This is often the lowest-risk first step.

## Mapping concepts
- Job/box/folder → DAG / workflow / task group.
- Conditions and cross-job dependencies → task dependencies; cross-DAG dependencies → datasets/assets, sensors, or event triggers (prefer events over polling sensors).
- Calendars → custom timetables or a calendar service table; do not hard-code holiday lists in each DAG.
- File watchers → object-storage event notifications or sensors in deferrable mode.
- Resource locks → pools/concurrency limits.
- JCL steps → explicit tasks with return-code mapping (COND/IF logic must be translated to branch/trigger rules).

## Sequencing
1. Export scheduler definitions (Control-M XML/JSON, AutoSys JIL, Tidal exports) and run history; build the dependency graph programmatically.
2. Identify dead jobs, duplicate schedules and manual operator interventions.
3. Generate DAGs from definitions where feasible, then hand-review; keep a mapping table old job → new task.
4. Run in "shadow" mode (new orchestrator triggers no-op or parallel tasks) to verify timing and dependencies.
5. Migrate by application/domain; bridge cross-domain dependencies temporarily (old scheduler triggering new via API, or vice versa).

## Operational must-haves
Alerting to the on-call tool, SLA misses, re-run from point of failure, manual hold/release, audit of who triggered what, secrets via a secrets manager, and environment promotion via CI/CD.

## What to ask
Number of jobs and applications, peak concurrent jobs, calendars in use, cross-application dependencies, mainframe involvement, operator team size and skills, and SLA penalties.

## Red flags
- Plan assumes "convert cron syntax" when jobs depend on calendars and conditions.
- Airflow used to move data itself (heavy work in workers) instead of triggering engines.
- No ownership model for DAG code; ops team not trained.
- Big-bang scheduler switch for thousands of jobs.
