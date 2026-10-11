# How Migration Atlas uses local AI

The model is a reasoning layer on top of deterministic knowledge — never the source of truth.
Everything below runs on Ollama on your machine.

## 1. Architecture options and best-fit recommendation

Generation produces **several genuinely different options**, not one answer
(`apps/backend/atlas/architecture/options.py`):

| Variant | What it is |
|---|---|
| **Requested** | The target you asked for (cloud + data platform) |
| **Alternative platform** | Same cloud, a different data platform (e.g. BigQuery instead of Databricks) |
| **Low-rewrite coexistence** | Keeps legacy ETL / scheduling / BI running against the new platform first |
| **Open & portable** | Open table formats, open-source streaming, SQL-first transformations |

Options that collapse into an existing one are dropped. Each option is scored **0–3 per
priority** (your stated constraints, weighted Low→Critical, plus low-weight baseline criteria:
rewrite effort, managed ops, lock-in, licensing, skills), and **every score carries its
evidence** ("Continuous CDC via Lakeflow Connect keeps the target in sync…"). The fit
percentage is the weighted score.

The local model then reads the fit table and returns a structured recommendation
(`recommended`, `rationale`, `choose_when` per option, `caveats`). The recommended letter is
validated against the real options; if the model is unavailable or invalid, the deterministic
best fit is used (ties go to the target you asked for). The UI always shows both the scores
with their evidence and who decided.

## 2. Intent routing for free text

`apps/backend/atlas/ai/router.py` classifies every copilot message deterministically:

| Intent | Example | What happens |
|---|---|---|
| `question` | "Why is CDC used here?" | Grounded, cited answer |
| `change` | "Replace Informatica with dbt", "Add disaster recovery" | Rule-backed + AI proposals rendered as **Apply** cards |
| `what_if` | "What if we avoid Kafka?", "How would this look on Azure?" | Interpreted scenario + **Create branch** card + impact answer |
| `recommend` | "Which option is the best fit for us?" | Fit table across all options + reasoned recommendation |

"Replace X with Y" resolves X even after it was modernised (e.g. Informatica → the Lakeflow
node that replaced it). Change requests answer instantly without a second model call.

## 3. Expert playbooks (skills)

`knowledge/skills/*.md` — 19 senior-architect playbooks (warehouse migration, Oracle, CDC &
cutover, ETL, orchestration, streaming, lakehouse design, platform selection, cloud landing
zones, governance & security, BI, mainframe, NoSQL/OLTP, Hadoop, reconciliation, cost/FinOps,
ML platforms, integration/APIs, explaining to executives).

Selection (`apps/backend/atlas/knowledge/skills.py`) is deterministic and explainable:
question keywords dominate, then technologies mentioned (with typo-tolerant matching), then
the estate weighted by importance (data stores and ETL over schedulers and BI). Cross-cutting
playbooks (cost, platform selection, executives) fire only when the question is about them; a
second playbook is included only when it is genuinely relevant. The top playbook goes into the
prompt in full. The UI shows which playbooks informed each answer.

## 4. Context and guardrails

Every architecture question includes: the architecture (compact), validation findings, estate,
ontology facts for the selection and mentioned technologies, knowledge-graph neighbourhood,
playbooks and up to four de-duplicated retrieved passages (`[S1]…`).

Guardrails: answer first, address the reader directly, cite sources, never invent prices or
SLAs, flag technology outside the ontology as general knowledge to verify, never change the
architecture silently.

Small-model robustness:

- **Thinking-only models** (qwen3 2507) narrate reasoning even with `think:false`; for models
  that report the `thinking` capability, chat runs in JSON mode and the `answer` field is
  streamed incrementally.
- **Narration filter**: opening sentences like "The user wants… / I need to…" are stripped.
- **Degenerate-answer retry**: if the model echoes the question or says almost nothing, it is
  retried once with a firmer instruction.
- Every structured output is parsed defensively and validated against the ontology.

## 5. Coverage

243 technologies (legacy and modern, data and application, all three clouds, NoSQL, query
engines, ELT SaaS, iPaaS, serverless, governance/observability tools), 55 migration mappings,
11 patterns, 41 curated documentation notes, 19 playbooks — all plain files you can extend.

## 6. Evaluation

`scripts/eval_ai.py` runs 20 representative questions against the live local model and checks
intent routing, expected actions, playbook selection, required concepts, absence of narration and
prompt leakage, length and latency:

```bash
python scripts/eval_ai.py --api http://127.0.0.1:8014
```

Run it after any prompt, playbook or model change. Results on `qwen3:4b` (M4, 24 GB) are recorded
in the section below.

### Latest results

| Round | Change | Result |
|---|---|---|
| 1 | Baseline with routing, playbooks, options | 18/20 cases · 178/180 checks |
| 2 | Keyword-led playbook selection; degenerate-answer retry | 20/20 · 180/180 (but reading answers found echoes, absent-tech what-ifs, misattributed citations) |
| 3 | Added "no echo" check | 16/20 · 196/200 — exposed the model sometimes returning the question as the answer |
| 4 | ~30% leaner context, explicit final turn, held-back first attempt + plain-mode retry | Echoes gone; median 37s. Remaining: one Ollama stall (27 min) |
| 4b | Hard deadlines on every model call, deterministic "X is not in this architecture" | Previously failing cases 5/5 · 50/50, median 35s |

Typical latency on qwen3:4b: change requests instant (rule proposals) to ~45s (with AI proposals); questions
25–55s; what-ifs ~25–35s. A faster model or a GPU with more memory shortens this proportionally.
