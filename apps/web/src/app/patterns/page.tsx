"use client";
import { LayoutTemplate } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PatternCard } from "@/components/catalog/pattern-card";
import { PageShell } from "@/components/shell";
import { EmptyState, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import { useOntology } from "@/lib/ontology";
import type { Pattern } from "@/lib/types";

export default function PatternsPage() {
  const { byId, loaded } = useOntology();
  const [patterns, setPatterns] = useState<Pattern[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState("");

  const load = useCallback(() => {
    setError(null);
    api.patterns().then(setPatterns).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const read = () => setHash(decodeURIComponent(window.location.hash.slice(1)));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  // Cards render after data arrives, so scroll to a deep-linked pattern once they exist.
  useEffect(() => {
    if (!patterns || !hash) return;
    const t = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    return () => clearTimeout(t);
  }, [patterns, hash, loaded]);

  return (
    <PageShell>
      <div className="mb-8 max-w-3xl animate-rise">
        <h1 className="text-[30px] font-semibold tracking-[-0.025em]">Architecture patterns</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Proven reference architectures for modernization. Each pattern is a template you can open in the studio as a starting point,
          then adapt, validate and compare against alternatives.
        </p>
        {patterns && patterns.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {patterns.map((p) => (
              <a key={p.id} href={`#${p.id}`} className="rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted transition-colors hover:border-border-strong hover:text-text">{p.name}</a>
            ))}
          </div>
        )}
      </div>
      {error ? (
        <div className="max-w-xl"><ErrorNote message={error} onRetry={load} /></div>
      ) : !patterns ? (
        <div className="space-y-6">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="shimmer h-[420px] rounded-2xl" />)}</div>
      ) : patterns.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No patterns installed" body="Add YAML files under /patterns to grow the library." />
      ) : (
        <div className="space-y-6">
          {patterns.map((p, i) => <PatternCard key={p.id} pattern={p} byId={byId} index={i} highlighted={hash === p.id} />)}
        </div>
      )}
    </PageShell>
  );
}
