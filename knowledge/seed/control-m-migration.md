---
vendor: BMC
product: Control-M
title: Control-M migration considerations
url: https://www.bmc.com/it-solutions/control-m.html
doc_type: curated-note
technologies: [control-m, apache-airflow, cloud-composer, databricks-workflows, aws-step-functions, amazon-mwaa]
version: null
---

## What it is

Control-M (BMC) is an enterprise workload automation platform used to schedule and monitor batch jobs across mainframe, distributed and cloud systems. Core concepts include *folders* (and sub-folders) containing *jobs*; *in/out conditions* for dependencies (including across folders and data centres); *calendars* (business days, holidays, period-based rules); *quantitative and control resources* for throttling and mutual exclusion; *cyclic jobs*; *file watchers*; *SLA management*; and agents that execute work on hosts. Jobs can be defined as code via the Control-M Automation API (JSON), and BMC offers a SaaS edition (Helix Control-M). Check BMC documentation for current product names and capabilities.

## Migration options

- **Retain Control-M as the enterprise orchestrator** and call cloud services via its integrations (Databricks, Airflow, AWS, Azure, GCP plug-ins). This minimises disruption and keeps operations tooling, but keeps licensing.
- **Move to cloud-native orchestration** (Airflow/Cloud Composer/MWAA, Databricks jobs, Step Functions, ADF). Usually paired with data-platform modernisation so jobs are rewritten anyway.
- **Hybrid**: Control-M continues for mainframe and cross-system dependencies; cloud orchestrators handle in-platform DAGs and are triggered by Control-M.

## Migration-relevant considerations

- **Export and analyse**: extract job definitions (XML/JSON) and run history to build the dependency graph, identify critical paths, run frequency, dormant jobs and SLAs.
- **Calendar semantics**: rich calendars (for example "last business day of the fiscal month") have no direct cron equivalent; implement as Airflow timetables, calendar tables, or guard tasks.
- **Cross-system conditions**: dependencies between mainframe, ETL and BI jobs are often implicit via conditions; losing them is a primary *scheduling dependency loss* risk.
- **Operational features**: manual holds, forced runs, confirmations, operator notes, ordering windows and re-run procedures are used by operations teams daily and need equivalents or explicit retirement.
- **Parallel run**: running the same job in both schedulers risks double execution; define which scheduler is authoritative per job during transition.

## Common pitfalls

- Converting job-for-job into one tiny DAG per job, losing end-to-end visibility.
- Ignoring resources and concurrency limits, overloading targets after migration.
- Forgetting post-processing actions (on-do actions, notifications, condition deletion) embedded in job definitions.
- Not involving the operations/run team in acceptance testing.
