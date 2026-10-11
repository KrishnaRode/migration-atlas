# Knowledge base

Migration Atlas answers architecture questions with retrieval-augmented generation (RAG) over a
small, curated, citable corpus. Everything here is local-first: the app works fully offline with
the seed notes, and online ingestion only happens for sources a user explicitly enables.

## Layout

| Path | Purpose |
| --- | --- |
| `sources.yaml` | Registry of official documentation sources that *may* be ingested. |
| `seed/*.md` | Curated reference notes shipped with the repo, so answers have citations offline. |

## Source registry (`sources.yaml`)

Each entry describes one official documentation source: `id`, `vendor`, `product`, `doc_type`
(`official-docs`, `github-docs` or `migration-guide`), `base_url`, `allowed_prefixes`, explicit
`seed_urls`, `rate_limit_seconds`, `max_pages`, `respect_robots`, `technologies` (ids from
`docs/ontology-ids.md`) and a `terms_note`.

**Every source ships with `enabled: false`.** Nothing is fetched until a user turns a source on.

### How ingestion stays polite and bounded

- **No broad crawling.** Only `seed_urls` are fetched, plus (at most) same-source links up to
  `max_pages` in total.
- **Allowed prefixes.** Any URL — seed or discovered link — that does not start with one of the
  source's `allowed_prefixes` is refused, including after redirects.
- **robots.txt.** When `respect_robots: true` (the default for every shipped source), the host's
  robots.txt is fetched and honoured; disallowed URLs are skipped, and a declared crawl-delay is
  used if it is longer than `rate_limit_seconds`.
- **Rate limiting.** Requests to a source are serialised with at least `rate_limit_seconds`
  between them.
- **Terms.** Vendor documentation is copyrighted. Ingested pages are stored locally for private
  reference, every chunk keeps its source URL for attribution, and users should read each
  source's `terms_note` and the vendor's site terms before enabling it.

## Seed notes (`seed/*.md`)

Short, original summaries written for this project (not copied vendor text), covering platform
services and recurring migration topics (CDC, reconciliation, cutover, Teradata/Netezza/Oracle/
mainframe migration, BI repointing). Each file starts with YAML front matter:

```yaml
---
vendor: Databricks
product: Unity Catalog
title: Unity Catalog — governance for the lakehouse
url: https://docs.databricks.com/aws/en/data-governance/unity-catalog/   # official page summarised
doc_type: curated-note
technologies: [unity-catalog, databricks]    # ontology ids only
version: null
---
```

The `url` lets the UI send the reader to the authoritative page. Notes deliberately say
"check current documentation" wherever product names, GA status or connector coverage change
often — treat them as orientation, and verify details against the linked source.

## Adding a documentation source

1. Append an entry to `sources.yaml` with a unique `id` and `enabled: false`.
2. Keep `allowed_prefixes` as narrow as possible (a product's docs path, not a whole domain).
3. List 5–10 explicit `seed_urls` that are relevant to migrations; prefer stable landing pages.
4. Use only technology ids that exist in `docs/ontology-ids.md`.
5. Keep `respect_robots: true` and a `rate_limit_seconds` of at least 1–2 seconds.
6. Enable it locally, run ingestion, and check the ingested pages before relying on them.

For documentation published as markdown in a public repository, use `doc_type: github-docs` and
point `allowed_prefixes`/`seed_urls` at `https://raw.githubusercontent.com/<org>/<repo>/<branch>/...`.

## Adding local documents

Internal material (architecture standards, past proposals, runbooks) can be added without any
network access: place markdown files with the same front matter as the seed notes (set
`doc_type` to something descriptive such as `internal-standard`, and `url` to an internal link or
`null`) in a local documents folder configured in the app, then re-index. Do not commit
confidential documents to this repository.
