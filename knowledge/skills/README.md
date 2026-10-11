# Expert playbooks (skills)

Playbooks are short, dense guides written the way a principal migration architect would brief a
colleague: decision heuristics, sequencing, pitfalls, sizing signals, validation, questions to ask
and red flags. They exist so a small local model (for example `qwen3:4b` with roughly 8k tokens of
context) can answer with senior-level judgement across a wide technology estate.

Playbooks complement the RAG corpus in `../seed/`: seed notes carry citable product facts;
playbooks carry *judgement*. They are original text written for this project.

## File format

One Markdown file per playbook, named `<id>.md`, with YAML front matter:

```markdown
---
id: warehouse-migration                 # kebab-case, unique, equals the file name
title: Warehouse migration (Teradata, Netezza, Exadata, Greenplum → cloud)
triggers:
  technologies: [teradata, netezza, bigquery]   # ids from ontology/technologies/*.yaml only
  roles: [legacy-warehouse, warehouse]          # roles from docs/ontology.md
  keywords: [warehouse, edw, bteq]              # lower-case words/phrases matched in the question
priority: 5                                     # 1-10, tie-breaker when scores are equal
---

## Section
- Bullets ...
```

Body rules:

- 350–600 words. The playbook is injected verbatim into the system prompt, so every word costs
  context on a small model.
- Short `##` sections and bullets. No marketing language and no fabricated prices or limits.
- Where product facts change often, say "verify current vendor docs".
- Recommended sections: decision heuristics, sequencing, pitfalls, sizing/cost signals,
  validation, what to ask, red flags.
- `triggers.technologies` may be empty (for example a persona playbook that triggers on keywords
  such as "cto" or "board").

## How selection works

For each question the backend scores every playbook:

1. **Technology match** — technology ids present in the current architecture (canvas nodes,
   estate) or recognised in the question (via ontology names/aliases) that appear in
   `triggers.technologies`.
2. **Role match** — roles of those technologies that appear in `triggers.roles`.
3. **Keyword match** — `triggers.keywords` found in the lower-cased question text.

Matches are weighted and summed; `priority` breaks ties. The **top 2** playbooks are injected into
the system prompt. Questions that match nothing get no playbook, and the model answers from the
ontology and retrieved seed notes alone.

## Adding or editing a playbook

1. Copy an existing file, change `id` (and the file name) and triggers.
2. Use only technology ids that exist in `ontology/technologies/*.yaml` and roles listed in
   `docs/ontology.md`.
3. Keep keywords specific. Generic words ("data", "cloud", "migration") match everything and
   crowd out better playbooks.
4. Validate front matter, ids and word counts before committing, e.g.:

```bash
uv run --with pyyaml python - <<'EOF'
import glob, re, yaml
ids = {t["id"] for f in glob.glob("ontology/technologies/*.yaml") for t in yaml.safe_load(open(f))}
for p in sorted(glob.glob("knowledge/skills/*.md")):
    if p.endswith("README.md"):
        continue
    _, fm, body = open(p).read().split("---", 2)
    meta = yaml.safe_load(fm)
    bad = set(meta["triggers"]["technologies"]) - ids
    print(p, len(re.findall(r"\S+", body)), "words", "unknown ids:" if bad else "", bad or "")
EOF
```

## Current playbooks

| id | Focus |
| --- | --- |
| `warehouse-migration` | Teradata/Netezza/Exadata/Greenplum to cloud warehouses and lakehouses |
| `oracle-database-modernization` | PL/SQL, data types, CDC, OLTP vs analytics targets |
| `cdc-and-low-downtime-cutover` | CDC tool choice, snapshot alignment, cutover runbook |
| `etl-modernization` | Informatica/DataStage/SSIS/Ab Initio/Talend to ELT; conversion reality |
| `orchestration-migration` | Control-M/AutoSys/Tidal/cron/JCL to Airflow, Workflows, Step Functions |
| `streaming-and-event-driven` | Queues vs logs, ordering, exactly-once, schema registry |
| `lakehouse-design` | Medallion, table formats, catalog, file sizing |
| `platform-selection` | Databricks, Snowflake, BigQuery, Redshift, Fabric decision criteria |
| `cloud-selection-and-landing-zone` | Cloud choice, hierarchy, identity, networking, guardrails |
| `data-governance-and-security` | Catalog, lineage, access, PII, residency, regulated industries |
| `bi-modernization` | Cognos/BO/MicroStrategy/Qlik/SSRS to Power BI, Looker, Tableau |
| `mainframe-modernization` | COBOL/CICS/VSAM/Db2/IMS, EBCDIC, rehost vs refactor, strangler fig |
| `nosql-and-operational-databases` | OLTP and NoSQL target choice from access patterns |
| `hadoop-migration` | Cloudera/HDFS/Hive/Impala/Oozie to cloud |
| `reconciliation-and-testing` | Counts, aggregates, hashes, parallel run, sign-off |
| `cost-and-finops` | TCO, licence exit, consumption traps, egress, commitments |
| `ml-and-ai-platform-migration` | SAS/on-prem ML to MLflow, Vertex AI, SageMaker, Azure ML |
| `integration-and-api-modernization` | ESB/MQ to APIs and events |
| `explaining-to-executives` | Framing trade-offs for CTOs and boards |
