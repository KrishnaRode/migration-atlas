---
vendor: Databricks
product: Databricks Asset Bundles
title: Databricks Asset Bundles — infrastructure-as-code for Databricks projects
url: https://docs.databricks.com/aws/en/dev-tools/bundles/
doc_type: curated-note
technologies: [databricks-asset-bundles, databricks, github-actions, azure-devops, gitlab-ci, terraform]
version: null
---

## What it is

Databricks Asset Bundles (DABs) are a way to describe a Databricks project — source code plus the resources that run it — as YAML configuration, and to validate, deploy and run it with the Databricks CLI. They bring software-engineering practices (version control, code review, CI/CD, environment promotion) to jobs, pipelines and other workspace resources.

## Key capabilities

- **`databricks.yml`** at the project root declares the bundle, includes further YAML files, defines variables and lists *targets* (for example `dev`, `staging`, `prod`) with per-target workspace hosts, permissions and overrides.
- **Resources**: jobs, Lakeflow Declarative Pipelines, model-serving endpoints, ML experiments and models, dashboards, schemas, volumes and more (the supported list grows over time; check current documentation).
- **CLI workflow**: `databricks bundle init` (templates), `validate`, `deploy`, `run` and `destroy`.
- **Development mode**: deployments in a development target are prefixed per user and have schedules paused, so engineers can iterate without colliding.
- **CI/CD**: bundles run unattended with service-principal authentication from GitHub Actions, Azure DevOps, GitLab CI, Jenkins and similar systems.

## Migration-relevant considerations

- **Treat converted code as a product**: when migrating hundreds of legacy ETL jobs, generate bundle YAML from the inventory so jobs, schedules, clusters and permissions are reproducible rather than hand-clicked.
- **Environment promotion**: use variables and targets for catalog names, storage paths and cluster policies, so the same definition deploys to every environment.
- **Relationship to Terraform**: bundles focus on project-level assets; workspace and account infrastructure (workspaces, networking, metastores, storage credentials) is generally still managed with Terraform. Agree the boundary to avoid two tools managing the same resource.
- **Ownership**: deploy production with a service principal so jobs do not break when an individual leaves.

## Common pitfalls

- Editing deployed jobs in the UI, causing drift that the next deploy silently overwrites.
- Hardcoding workspace URLs, cluster IDs or secrets in YAML instead of variables and secret scopes.
- One giant bundle for an entire platform, making deployments slow and risky; split by domain or team.
- Skipping `bundle validate` in pull-request checks.
