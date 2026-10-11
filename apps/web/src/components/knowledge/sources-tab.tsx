"use client";
import { DownloadCloud, ExternalLink, Gauge, Link2, ShieldCheck, ShieldOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatDate, stagger } from "@/components/catalog/primitives";
import { Badge, Button, Card, ErrorNote, SectionLabel } from "@/components/ui";
import { api } from "@/lib/api";
import type { KnowledgeSource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { IngestSummary, type IngestRun } from "./ingest-result";

function Toggle({ on, onChange, busy, label }: { on: boolean; onChange: (v: boolean) => void; busy?: boolean; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={() => onChange(!on)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60", on ? "bg-accent" : "bg-surface-3")}>
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

function SourceCard({ src, index, onChanged }: { src: KnowledgeSource; index: number; onChanged: () => void }) {
  const [toggling, setToggling] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [runs, setRuns] = useState<IngestRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (enabled: boolean) => {
    setToggling(true); setError(null);
    try { await api.toggleSource(src.id, enabled); onChanged(); } catch (e) { setError((e as Error).message); } finally { setToggling(false); }
  };
  const ingest = async () => {
    setIngesting(true); setError(null);
    try { const r = await api.ingest({ source_id: src.id }); setRuns(r.results); onChanged(); }
    catch (e) { setError((e as Error).message); } finally { setIngesting(false); }
  };

  return (
    <div style={stagger(index, 40)} className="animate-rise">
      <Card className={cn("p-5 transition-colors", !src.enabled && "bg-surface/70")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[14px] font-semibold tracking-[-0.01em]">{src.vendor} · {src.product}</span>
              <Badge color="var(--info)">{src.doc_type}</Badge>
              {src.respect_robots ? <Badge color="var(--ok)"><ShieldCheck size={10} /> robots.txt respected</Badge> : <Badge color="var(--warn)"><ShieldOff size={10} /> robots.txt ignored</Badge>}
            </div>
            <a href={src.base_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate font-mono text-[11.5px] text-muted hover:text-accent">
              {src.base_url} <ExternalLink size={10} className="shrink-0" />
            </a>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] font-medium text-muted">
            {src.enabled ? "Enabled" : "Disabled"}
            <Toggle on={src.enabled} busy={toggling} onChange={toggle} label={`Enable ${src.vendor} ${src.product}`} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
          <Stat label="Documents" value={String(src.document_count)} />
          <Stat label="Seed URLs" value={String(src.seed_urls.length)} />
          <Stat label="Rate limit" value={`${src.rate_limit_seconds}s / req`} icon={<Gauge size={11} />} />
          <Stat label="Last ingested" value={formatDate(src.last_ingested_at)} />
        </div>

        {src.allowed_prefixes.length > 0 && (
          <div className="mt-4">
            <SectionLabel className="mb-1.5">Allowed prefixes</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {src.allowed_prefixes.map((p) => <span key={p} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted"><Link2 size={9} />{p}</span>)}
            </div>
          </div>
        )}
        {src.terms_note && <p className="mt-3 text-[11.5px] leading-relaxed text-faint">{src.terms_note}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button size="sm" variant={src.enabled ? "primary" : "secondary"} icon={DownloadCloud} loading={ingesting} disabled={!src.enabled} onClick={ingest}>
            Ingest seed pages
          </Button>
          <span className="text-[11.5px] text-faint">
            {src.enabled ? `Fetches up to ${src.max_pages} pages from ${src.seed_urls.length} seed URL${src.seed_urls.length === 1 ? "" : "s"}.` : "Enable this source to allow fetching."}
          </span>
        </div>
        {error && <div className="mt-3"><ErrorNote message={error} /></div>}
        {runs && <div className="mt-3"><IngestSummary runs={runs} /></div>}
      </Card>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2/70 px-3 py-2">
      <div className="text-[10.5px] uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-0.5 inline-flex items-center gap-1 font-medium text-text">{icon}{value}</div>
    </div>
  );
}

function UrlIngest({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<IngestRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urls = text.split("\n").map((u) => u.trim()).filter(Boolean);

  const submit = async () => {
    setBusy(true); setError(null); setRuns(null);
    try { const r = await api.ingest({ urls }); setRuns(r.results); onDone(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Card className="p-5">
      <div className="text-[14px] font-semibold">Ingest specific URLs</div>
      <p className="mt-1 text-[12.5px] text-muted">One URL per line. Each must sit under an allowed prefix of a registered, enabled source — anything else is rejected and never fetched.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} spellCheck={false}
        placeholder={"https://docs.databricks.com/en/ingestion/auto-loader/index.html\nhttps://cloud.google.com/bigquery/docs/migration/teradata"}
        className="mt-3 w-full resize-y rounded-xl border border-border bg-surface-2/50 p-3 font-mono text-[12px] outline-none transition-all placeholder:text-faint focus:border-accent focus:bg-surface" />
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" icon={DownloadCloud} loading={busy} disabled={!urls.length} onClick={submit}>Ingest {urls.length || ""} URL{urls.length === 1 ? "" : "s"}</Button>
        {runs && <span className="text-[12px] text-muted">{runs.reduce((n, r) => n + r.ingested.length, 0)} ingested</span>}
      </div>
      {error && <div className="mt-3"><ErrorNote message={error} /></div>}
      {runs && <div className="mt-3"><IngestSummary runs={runs} /></div>}
    </Card>
  );
}

export function SourcesTab() {
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api.sources().then((s) => { setSources(s); setError(null); }).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error && !sources) return <ErrorNote message={error} onRetry={load} />;
  if (!sources) return <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-64 rounded-2xl" />)}</div>;

  const enabled = sources.filter((s) => s.enabled).length;
  return (
    <div className="space-y-5">
      <div className="text-[12.5px] text-muted">{sources.length} registered sources · {enabled} enabled. Sources are defined in <code className="rounded bg-surface-2 px-1 font-mono text-[11.5px]">knowledge/sources.yaml</code>.</div>
      <div className="grid gap-4 lg:grid-cols-2">
        {sources.map((s, i) => <SourceCard key={s.id} src={s} index={i} onChanged={load} />)}
      </div>
      <UrlIngest onDone={load} />
    </div>
  );
}
