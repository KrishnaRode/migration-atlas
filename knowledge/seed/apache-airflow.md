---
vendor: Apache Software Foundation
product: Apache Airflow
title: Apache Airflow — workflow orchestration as Python code
url: https://airflow.apache.org/docs/apache-airflow/stable/index.html
doc_type: curated-note
technologies: [apache-airflow, cloud-composer, amazon-mwaa, kubernetes, control-m, autosys]
version: null
---

## What it is

Apache Airflow is an open-source platform for authoring, scheduling and monitoring workflows defined in Python as DAGs (directed acyclic graphs). It is widely used to orchestrate data pipelines across databases, warehouses, lakehouses and cloud services. Managed offerings include Google Cloud Composer, Amazon MWAA and Astronomer. Airflow 3 (released in 2025) introduced significant architectural and API changes relative to Airflow 2; check current documentation for version-specific behaviour.

## Key concepts

- **DAGs, tasks and operators**: operators (Bash, Python, SQL, provider operators for BigQuery, Databricks, Snowflake, dbt, etc.) define units of work; the TaskFlow API lets plain Python functions become tasks.
- **Scheduling**: cron expressions, presets, timetables for custom calendars, and data-aware scheduling (datasets, renamed *assets* in Airflow 3) to trigger DAGs when upstream data is updated.
- **Sensors and deferrable operators** wait for external conditions (files, partitions, other DAGs); deferrable operators free worker slots while waiting.
- **Executors**: Local, Celery and Kubernetes executors (and hybrid configurations) determine how tasks run.
- **Operations**: retries, SLAs/callbacks, pools for concurrency control, backfills, and a web UI for runs and logs.

## Migration-relevant considerations

- **From Control-M, AutoSys, Tidal, cron**: map job streams to DAGs, job conditions to dependencies (`>>`, cross-DAG sensors or assets), calendars to timetables, and quantitative resources to pools. Features such as operator-driven holds, manual confirmations and rich calendars need explicit design.
- **Separation of concerns**: Airflow should orchestrate; heavy processing belongs in the execution platform (Spark, Databricks, BigQuery, Snowflake).
- **Idempotency**: tasks should be safely rerunnable for a logical date, which is essential for backfills and recovery.
- **Version strategy**: pin provider packages and test upgrades; Airflow 2 → 3 migrations require code and configuration changes.

## Common pitfalls

- Heavy top-level code in DAG files that slows parsing and the scheduler.
- Passing large data via XCom instead of references to storage.
- Using `datetime.now()` instead of the logical date, breaking backfills.
- Hundreds of near-identical DAGs instead of generated or parameterised ones.
