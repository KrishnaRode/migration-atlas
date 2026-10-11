# Architecture

## Principles

1. **The canvas is the product.** AI is an assistant to the canvas, never a replacement for it.
2. **Deterministic first.** Rules and the ontology produce every fact the UI shows; the LLM reviews,
   explains and proposes.
3. **Nothing silent.** Model output is parsed, validated against the ontology, and either merged into
   an initial draft (marked as AI) or returned as a proposal the user must apply.
4. **Local by default.** Ollama, SQLite, NetworkX, files on disk. No cloud services, no telemetry.
5. **Data, not code.** Technology knowledge lives in YAML so domain experts can improve it without
   touching Python or TypeScript.

## Components

```
Browser (Next.js, React Flow)                         FastAPI (apps/backend/atlas)
┌──────────────────────────────┐   JSON / SSE    ┌────────────────────────────────────────────┐
│ Studio store (zustand)       │ ──────────────▶ │ api/          routers, error envelope       │
│  · architecture ⇄ RF nodes   │                 │ ontology/     loader · search · aliases     │
│  · undo/redo, autosave       │                 │ rules/        connections · validator       │
│ ELK layout (lib/layout.ts)   │                 │ architecture/ generator · ops · what-if     │
│ Canvas · Library · Inspector │                 │ migration/    dependencies · roadmap        │
│ Copilot (SSE) · Validation   │                 │ ai/           ollama · prompts · copilot    │
│ Persona views · Compare      │                 │ knowledge/    registry · ingest · store ·   │
│ Exports (html-to-image)      │                 │               graph                         │
└──────────────────────────────┘                 │ export/       markdown · pdf                │
                                                 │ storage/      sqlite                        │
                                                 └───────────────┬────────────────────────────┘
                                                                 │ HTTP
                                                     Ollama (local models)
```

## Generation pipeline

| # | Stage | What it does |
|---|---|---|
| 1 | Deterministic rules | Resolve target cloud + data platform; assemble zones, ingestion, transformation, orchestration, serving, governance, security, network, monitoring and CI/CD from `ontology/platforms.yaml` |
| 2 | Ontology | Map each legacy component through `possible_targets`, `suggested_next` and constraints (minimise downtime → CDC + coexistence; reduce licensing → replace commercial BI; minimise rewrite → rehost) |
| 3 | Knowledge graph | MIGRATES_TO / REPLACES neighbourhoods inform context and search |
| 4 | RAG | Retrieve cited passages for the estate and target |
| 5 | Ollama review | JSON-only review of the draft; ≤3 additions, each checked (exists, not legacy, runs on the cloud, compatible with the platform, connectable); notes/assumptions/risks marked AI |
| 6 | Validation | Rule engine findings + health dimensions; edge statuses annotated |

Migration scaffolding (reconciliation, parallel run, cutover, rollback) is deliberately not part of
the target state; the validator raises it so the team decides how to run the migration, and
generating a roadmap records cutover/rollback/parallel-run as migration controls.

## Connection intelligence

Rules in `ontology/connection_rules.yaml` match `tech:`, `stage:`, `role:` or `*` on both ends; the
most specific rule wins. Data edges that the rule classifies as control-plane (e.g. an orchestrator
"feeding" storage) are downgraded to a warning with an explanation.

## Validator

Each check is a function over the graph that records evidence for a health dimension and, when it
fails, a finding with severity, affected nodes/edges, recommendation and — where the fix is mechanical
— a `Proposal` with operations (`add_node`, `replace_node`, `set_control`, …) that the UI can apply.

## AI integration details

- **Structured calls** use Ollama JSON mode with `think: false`, low temperature, parsed by
  `ai/parsing.py` (fences, `<think>` blocks, trailing commas) and validated with Pydantic.
- **Chat** streams over SSE. For models that report the `thinking` capability (qwen3 2507), the
  answer is requested inside `{"answer": "…"}` and decoded incrementally so reasoning never leaks.
- **Context** for every architecture question: compact architecture rendering, validation findings,
  estate, ontology facts for the selection, knowledge-graph neighbourhood and up to four de-duplicated
  retrieved passages labelled `[S1]…[S4]`.
- **Personas** change framing only; the facts in context are identical.

## Storage

`data/atlas.db` (SQLite, WAL): `projects` (JSON documents), `settings`, `kb_documents`, `kb_chunks`,
`kb_source_state`. `data/knowledge_graph.json`: node-link graph. Delete `data/` to reset.
