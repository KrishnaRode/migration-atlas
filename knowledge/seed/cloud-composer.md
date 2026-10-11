---
vendor: Google Cloud
product: Cloud Composer
title: Cloud Composer — managed Apache Airflow on Google Cloud
url: https://cloud.google.com/composer/docs
doc_type: curated-note
technologies: [cloud-composer, apache-airflow, gcp, google-cloud-storage, control-m]
version: null
---

## What it is

Cloud Composer is Google Cloud's managed Apache Airflow service. It provisions and operates the Airflow scheduler, workers, web server, metadata database and DAG storage (a Cloud Storage bucket), so teams author DAGs in Python without running Airflow infrastructure themselves.

## Key capabilities

- **Environment generations**: Composer 2 runs on GKE Autopilot in the customer project; Composer 3 further abstracts infrastructure. Supported Airflow versions per generation change over time (including Airflow 3 support) — check current documentation and version-support timelines.
- **Google Cloud operators**: provider packages for BigQuery, Dataflow, Dataproc, Cloud Storage, Pub/Sub, Datastream, Vertex AI and more, plus community providers for Databricks, Snowflake, dbt and others.
- **Scaling**: worker autoscaling within configured minimum/maximum, and environment sizes for the managed components.
- **Security**: runs as a service account, supports private IP environments, CMEK, VPC Service Controls and Secret Manager as an Airflow secrets backend.
- **Operations**: Airflow UI, Cloud Logging and Cloud Monitoring integration, environment snapshots for backup and migration between environments.

## Migration-relevant considerations

- **From enterprise schedulers** (Control-M, AutoSys, Tidal): Airflow models workflows as Python DAGs with schedule intervals, not as calendar-driven job streams. Business calendars, cross-DAG conditions, cyclic jobs and operator alerting must be re-expressed (timetables, sensors/deferrable operators, datasets/assets, callbacks).
- **Version upgrades**: Composer images pin Airflow and provider versions; plan for periodic upgrades, and test DAGs against new versions, especially across Airflow 2 → 3 breaking changes.
- **Workload placement**: Airflow should orchestrate, not process data. Heavy work belongs in BigQuery, Dataflow, Dataproc or Databricks.
- **Cost**: environments have a baseline cost even when idle; consolidate small environments where governance allows.

## Common pitfalls

- Top-level DAG code that queries databases or APIs at parse time, slowing the scheduler.
- Installing many conflicting PyPI packages into the environment; use KubernetesPodOperator or containers for unusual dependencies.
- Storing credentials in Airflow Variables in plain text instead of a secrets backend.
- Large XCom payloads stored in the metadata database.
