"use client";
import { ExternalLink, FileText, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { formatDate, humanize, stagger } from "@/components/catalog/primitives";
import { Badge, Button, Card, EmptyState, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import type { SearchHit } from "@/lib/types";

const EXAMPLES = ["Delta Lake change data feed", "Informatica mapping conversion", "Unity Catalog lineage", "Kafka exactly-once"];

export function SearchTab() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ q: string; hits: SearchHit[]; mode: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (q = query) => {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setLoading(true);
    setError(null);
    try {
      const r = await api.knowledgeSearch(text, { limit: 12 });
      setState({ q: text, ...r });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void run(); };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="flex gap-2">
        <div className="group relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint group-focus-within:text-accent" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask the local knowledge base, e.g. 'Auto Loader schema evolution'"
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-[14px] shadow-soft outline-none transition-all placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-soft)]" />
        </div>
        <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!query.trim()} icon={Search}>Search</Button>
      </form>

      {error && <ErrorNote message={error} onRetry={() => void run()} />}

      {!state && !loading && !error && (
        <Card className="p-2">
          <EmptyState icon={FileText} title="Search across every local document"
            body="Hybrid retrieval when an embedding model is configured in Settings, lexical otherwise."
            action={<div className="flex flex-wrap justify-center gap-1.5">{EXAMPLES.map((ex) => <Button key={ex} size="sm" variant="ghost" onClick={() => void run(ex)}>{ex}</Button>)}</div>} />
        </Card>
      )}

      {loading && !state && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="shimmer h-28 rounded-2xl" />)}</div>}

      {state && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="mb-3 flex items-center gap-2 text-[12.5px] text-muted">
            {state.hits.length} result{state.hits.length === 1 ? "" : "s"} for “{state.q}”
            <Badge color={state.mode === "hybrid" ? "var(--modern)" : "var(--info)"} title={state.mode === "hybrid" ? "Lexical + embedding similarity" : "Keyword (BM25-style) ranking"}>{state.mode}</Badge>
          </div>
          {state.hits.length === 0 ? (
            <Card><EmptyState icon={Search} title="No matching passages" body="Try different wording, ingest an official source, or upload your own documents." /></Card>
          ) : (
            <div className="space-y-3">
              {state.hits.map((h, i) => {
                const c = h.citation;
                const link = /^https?:/.test(c.url);
                return (
                  <div key={h.chunk_id} style={stagger(i, 40)} className="animate-rise rounded-2xl border border-border bg-surface p-4 shadow-soft">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      <Badge color={c.doc_type === "curated-note" ? "var(--modern)" : "var(--info)"}>{c.doc_type === "curated-note" ? "Curated note" : humanize(c.doc_type)}</Badge>
                      <span className="font-medium text-text">{c.vendor}</span>
                      <span className="text-faint">· source {c.source_id}</span>
                      <span className="ml-auto font-mono text-[11px] text-faint" title="Relevance score">{h.score.toFixed(3)}</span>
                    </div>
                    <div className="mt-2 text-[14px] font-semibold tracking-[-0.01em]">
                      {link ? <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">{c.title} <ExternalLink size={12} className="inline" /></a> : c.title}
                    </div>
                    <p className="mt-1.5 line-clamp-4 text-[13px] leading-relaxed text-muted">{h.text}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
                      {link && <span className="max-w-full truncate font-mono">{c.url}</span>}
                      <span>Retrieved {formatDate(c.retrieved_at)}</span>
                      {h.technologies.slice(0, 4).map((t) => <Badge key={t}>{t}</Badge>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
