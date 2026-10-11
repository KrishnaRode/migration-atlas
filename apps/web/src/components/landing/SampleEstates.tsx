"use client";
import { ArrowUpRight, Loader2, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorNote } from "@/components/ui";
import { TransitionChips } from "@/components/projects/TechChips";
import { api } from "@/lib/api";
import { useOntology } from "@/lib/ontology";
import type { Sample } from "@/lib/types";
import { useOpenSample } from "./useOpenSample";

export function SampleCard({ s, onOpen, pending, i = 0, compact }:
  { s: Sample; onOpen: () => void; pending: boolean; i?: number; compact?: boolean }) {
  const { byId } = useOntology();
  return (
    <button onClick={onOpen} disabled={pending}
      className="group flex h-full w-full animate-rise flex-col rounded-2xl border border-border bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift disabled:opacity-80"
      style={{ animationDelay: `${i * 60}ms` }}>
      <div className="flex w-full items-start justify-between gap-3">
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-muted">{s.industry}</span>
        {pending ? <Loader2 size={15} className="animate-spin text-accent" />
          : <ArrowUpRight size={15} className="text-faint transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />}
      </div>
      <div className="mt-3 text-[14.5px] font-semibold leading-snug tracking-[-0.015em]">{s.title}</div>
      <div className="mt-1 text-[12.5px] text-muted">{s.subtitle}</div>
      {!compact && <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-faint">{s.description}</p>}
      <div className="mt-auto pt-4">
        <TransitionChips current={s.current} target={s.target} byId={byId} max={compact ? 2 : 3} />
      </div>
    </button>
  );
}

export function useSamples() {
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.samples().then((s) => alive && setSamples(s)).catch((e) => alive && setError(e instanceof Error ? e.message : "Backend unreachable"));
    return () => { alive = false; };
  }, []);
  // Featured samples first.
  const sorted = samples ? [...samples].sort((a, b) => Number(b.featured) - Number(a.featured)) : null;
  return { samples: sorted, error };
}

export function SampleEstates() {
  const { samples, error } = useSamples();
  const { open, pending, error: openError } = useOpenSample();
  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-24">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Sample estates</div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-[-0.03em] sm:text-[36px]">Start from a real-world estate.</h2>
        </div>
        <p className="max-w-[360px] text-[13px] text-muted">Open one and Migration Atlas generates a target architecture in seconds.</p>
      </div>
      {openError && <div className="mt-6"><ErrorNote message={openError} /></div>}
      <div className="mt-10">
        {error ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border-strong px-5 py-4 text-[13px] text-muted">
            <Terminal size={16} className="shrink-0 text-faint" />
            <span>Sample estates appear when the local backend is running. Start it with <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-text">./start.sh</code></span>
          </div>
        ) : !samples ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="shimmer h-[200px] rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {samples.map((s, i) => <SampleCard key={s.id} s={s} i={i} pending={pending === s.id} onOpen={() => open(s.id)} />)}
          </div>
        )}
      </div>
    </section>
  );
}
