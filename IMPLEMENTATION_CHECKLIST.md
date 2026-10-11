# Implementation checklist

Tracks the product brief section by section. ✅ done and verified · ◐ done with a stated limit.

## Phase 1 — Foundation
- ✅ Monorepo: `apps/web` (Next.js 15, TS strict, Tailwind v4), `apps/backend` (FastAPI, Pydantic), `ontology/`, `patterns/`, `knowledge/`, `sample-estates/`, `scripts/`, `docs/`, `docker/`
- ✅ SQLite persistence for projects, settings and the knowledge store (`data/atlas.db`)
- ✅ One-command start: `./start.sh`, `start.bat`, `make dev`, optional `docker compose up`

## Phase 2 — Ontology, library, canvas
- ✅ §10 Ontology as YAML: Technology, Capability, Vendor, ConnectionRule, MigrationMapping, Risk, Strategy, Pattern, Constraint; 172 technologies; loader validates every cross-reference (0 problems)
- ✅ §58 Seed coverage for every listed technology (Oracle … GCP), plus mainframe, BI, security, observability, DevOps, networking
- ✅ §9 Component library: 26 categories, search, category chips, modern/legacy scope, drag & double-click
- ✅ §8 React Flow canvas: drag/drop, zoom, pan, minimap, multi-select, grouping (⌘G), snapping, auto-layout (L), connection handles, editable connections, undo/redo, delete, duplicate (⌘D), shortcuts, fit (F), full screen, search, filtering
- ✅ §38 Node design: icon, name, category, vendor, environment, strategy, AI marker, finding badge
- ✅ §39 Connection metadata (mode, frequency, format, latency, label, kind), editable in the inspector
- ✅ §40 Swimlanes: Sources → Consumption columns, Governance / Security / Operations rows

## Phase 3 — Editing, persistence, layout
- ✅ Save/load with debounced autosave; options (branches) per project
- ✅ ELK auto-layout with layer partitions; medallion zones stacked; cross-cutting rows placed under what they serve
- ✅ JSON export and re-import (project or bare architecture), validated on import

## Phase 4 — Local AI
- ✅ §31 Ollama service: discovery, model selection, base URL, test, streaming, timeouts, retries, setup guidance, never crashes
- ✅ §14 Model-agnostic (Qwen, Llama, Mistral, Gemma, Phi); capability detection for thinking-only models
- ✅ §6 Natural-language estate parser (rules first, AI refines, ids validated) + structured pickers
- ✅ §13 AI architecture generation: structured JSON only, no coordinates; ELK layout
- ✅ §29 Hybrid pipeline: rules → ontology → graph → RAG → Ollama → validation, surfaced step by step in the UI

## Phase 5 — Intelligence
- ✅ §11 Connection intelligence with 5 statuses, reasons, suggestions and matched rule
- ✅ §12 Smart "possible next components" on drop
- ✅ §19 Deterministic validator: data, governance, security, reliability, observability, migration, architecture; Critical→Info; shown on the graph
- ✅ §20 Health panel: 7 explainable dimensions with evidence; no single score
- ✅ §15 AI actions as proposals (Apply / Dismiss / Explain); rule-backed and model-backed
- ✅ §16 Replace with…: ontology-ranked alternatives, compatible connections preserved, operational change described, ADR shortcut

## Phase 6 — Knowledge
- ✅ §25/26 Source registry (19 sources, all disabled by default), allowed prefixes, robots.txt, rate limits, redirect checks, no crawler; HTML/Markdown/PDF/GitHub raw/local uploads
- ✅ §27 Local RAG: chunking, metadata filters, BM25 + optional Ollama embeddings, citations (source, vendor, title, URL, retrieved date)
- ◐ Vector store is an SQLite-backed equivalent of Chroma (no extra download on a constrained disk); the store interface is small enough to swap
- ✅ §28 NetworkX knowledge graph persisted as JSON behind `GraphStore` (Neo4j-ready)
- ✅ 41 curated seed notes so citations work offline

## Phase 7 — Planning & personas
- ✅ §21 Eight migration strategies; AI/rules suggest, user decides
- ✅ §22 Source-to-target mappings (35) with approaches, considerations, risks, automation potential, manual effort
- ✅ §23 12-wave roadmap customised from the architecture; AI narrative optional
- ✅ §24 Dependency graph drives wave order (includes replaced legacy systems from the estate)
- ✅ §17 What-if branches (never destroys the original); §18 descriptive side-by-side comparison
- ✅ §2/43/44/45 Persona switch + Leader, Developer and Architect views
- ✅ §42 ADRs: create from replacement or context menu, edit, export Markdown
- ✅ §14 Copilot with architecture JSON + ontology + graph + RAG context, persona framing, §41 explainability structure

## Phase 8 — Exports & polish
- ✅ §36 PNG, SVG, JSON, Markdown, PDF (all required report sections; diagram embedded)
- ✅ §4 Landing with animated modernising mini-architecture; §63 home message; §64 Sunday Builds footer
- ✅ §5 Project dashboard; §32 five sample estates; §33 polished GCP + Databricks reference pattern; §34 11 patterns
- ✅ §35 ⌘K command palette; §46 technology pages; §47 global search
- ✅ §37 Premium dark/light UI; §48 "Local AI" indicator and privacy statements
- ✅ §52 Errors are typed and friendly everywhere; no stack traces reach the UI
- ✅ §53 Tests: 58 backend, 9 UI component, 11-step end-to-end smoke test (real local AI)
- ✅ §56 README; §55 demo journey verified in the browser and headless

## Verified demo journey (§65)
Estate input → AI architecture → visual canvas → drag component → connect → AI explanation →
validation → AI improvement (reconciliation) → roadmap → PDF/PNG export — verified in the running
app and by `scripts/smoke_test.py` against `qwen3:4b`.

## Known limits
- Browser drag-and-drop is HTML5 DnD; automated UI drivers that synthesise mouse events cannot trigger it (real users and the double-click/⌘K paths are unaffected).
- What-if branches regenerate from the estate plus the scenario; manual edits on the source option are not carried into the branch.
- Small local models occasionally propose odd changes; every proposal is ontology-checked and requires Apply.

## Iteration 2 — alternatives and AI depth
- ✅ Every generation produces distinct architecture options (requested · alternative platform · low-rewrite coexistence · open & portable), shown as tabs with fit % and a "Best fit" marker
- ✅ Priority-fit analysis: 0–3 score per stated priority (weighted Low→Critical) plus baseline criteria, each with evidence; local AI recommendation validated against real options; "choose this when" for every option
- ✅ Options view: recommendation card, fit matrix with evidence, side-by-side comparison; "Generate alternatives" for single-option projects
- ✅ Copilot intent routing: question / change (Apply cards) / what-if (Create branch) / recommend (fit table)
- ✅ 19 expert playbooks selected per question (keywords > mentioned tech (typo-tolerant) > estate by importance); shown with each answer
- ✅ Ontology expanded to 243 technologies and 55 mappings (ELT SaaS, query engines, NoSQL, iPaaS, serverless, governance tools)
- ✅ Small-model robustness: narration filter, question-echo removal, degenerate-answer retry, honest "outside the ontology" answers
- ✅ `scripts/eval_ai.py` — 20-case evaluation with automatic checks; results in docs/ai.md
