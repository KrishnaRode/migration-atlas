---
id: ml-and-ai-platform-migration
title: ML and AI platform migration (SAS, on-prem ML → MLflow, Vertex AI, SageMaker, Azure ML)
triggers:
  technologies: [mlflow, vertex-ai, amazon-sagemaker, azure-machine-learning, databricks-model-serving, databricks, bigquery, snowflake]
  roles: [ml]
  keywords: [machine learning, ml, sas, ml model, mlops, feature store, model registry, model governance, scoring, inference, training, genai, llm, data science, spss]
priority: 5
---

## Separate the estate into four things
1. **Data preparation** (often SAS DATA steps, PROC SQL, SPSS streams) — usually the bulk of code; belongs on the data platform (SQL/Spark/pandas).
2. **Models** (statistical models, scorecards, ML) — training code and artefacts.
3. **Scoring** (batch scoring jobs, real-time APIs, in-database scoring).
4. **Governance** (model inventory, validation, approvals, monitoring) — critical in regulated industries.
Each moves differently.

## Target heuristics
- Platform already chosen for data → prefer its ML stack to keep data in place: Databricks (MLflow, Feature Store/feature engineering in Unity Catalog, Model Serving), BigQuery + Vertex AI, Snowflake (Snowpark ML/Cortex — verify current features), SageMaker on AWS, Azure ML on Azure/Fabric.
- MLflow is the de facto open standard for tracking and model packaging; it also runs on SageMaker and Azure ML (verify current integration level).
- Avoid splitting feature engineering on one platform and training on another without a clear reason; egress, duplication and lineage gaps follow.

## SAS migration realities
- Inventory programs, macros, formats, and which outputs feed regulatory or business decisions. Many SAS jobs are reporting or data prep, not modelling.
- Automated SAS-to-Python/PySpark converters help with DATA steps and PROC SQL; statistical PROCs (e.g., mixed models, survival, specific credit-risk procedures) need validated equivalents in Python/R libraries — results may differ numerically and must be re-validated.
- Regulated models (credit risk, AML, pricing): re-implementation can trigger model re-validation with the model risk team; plan the timeline with them. Sometimes keeping SAS (including SAS Viya on cloud) for a subset is the pragmatic answer.
- Analyst skill transition (SAS → Python/SQL) is the long pole; budget training and pairing.

## MLOps foundations
- Version everything: code (Git), data (table versions/snapshots), models (registry), environments (containers or pinned dependencies).
- Registry with stages/aliases and approval workflow; link each model to training data, code commit and evaluation results.
- Feature store or governed feature tables to keep training/serving consistent and avoid leakage; point-in-time correct joins for training sets.
- Monitoring: data drift, prediction drift, performance against delayed labels, latency/cost for endpoints.
- CI/CD for models with automated tests and human approval gates for high-risk models.

## Scoring migration
Prove parity by scoring the same population on old and new pipelines and comparing outputs within agreed tolerances (rank ordering, score distribution, decision outcomes). Real-time endpoints need load testing and fallback behaviour.

## GenAI considerations
Treat LLM applications as a separate workload with its own governance: data residency of model endpoints, prompt/response logging, evaluation sets, PII handling, and cost controls. Verify regional availability of hosted models.

## What to ask
Number of models and their criticality, regulatory status, SAS licence end date, scoring modes and latency, data scientists' skills, existing model inventory, monitoring practice.

## Red flags
- "Convert all SAS code automatically" without model risk involvement.
- Notebooks as the production deployment mechanism.
- No lineage from model to training data.
- Feature logic duplicated between training and serving.
