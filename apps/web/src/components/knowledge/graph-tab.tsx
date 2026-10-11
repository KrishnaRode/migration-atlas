"use client";
import { GitFork, Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { humanize, stagger } from "@/components/catalog/primitives";
import { Card, ErrorNote, SectionLabel } from "@/components/ui";
import { api } from "@/lib/api";

type Stats = Awaited<ReturnType<typeof api.graphStats>>;

const KIND_COLOR: Record<string, string> = {
  Technology: "var(--accent)", Vendor: "var(--muted)", Capability: "var(--modern)", Risk: "var(--warn)",
  MigrationPattern: "var(--info)", ArchitecturePattern: "#8b5cf6", Documentation: "var(--ok)",
};

function Bars({ data, color }: { data: Record<string, number>; color: (k: string) => string }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div className="space-y-2.5">
      {rows.map(([k, v], i) => (
        <div key={k} style={stagger(i, 40)} className="animate-rise">
          <div className="mb-1 flex items-baseline justify-between text-[12px]">
            <span className="font-medium text-text">{humanize(k.replace(/([a-z])([A-Z])/g, "$1 $2"))}</span>
            <span className="font-mono tabular-nums text-muted">{v.toLocaleString()}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(v / max) * 100}%`, background: color(k) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GraphTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    api.graphStats().then(setStats).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorNote message={error} onRetry={load} />;
  if (!stats) return <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-40 rounded-2xl" />)}</div>;

  const tiles = [
    { label: "Nodes", value: stats.nodes },
    { label: "Relationships", value: stats.edges },
    { label: "Node kinds", value: Object.keys(stats.node_kinds).length },
    { label: "Relation types", value: Object.keys(stats.relations).length },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.label} style={stagger(i, 50)} className="animate-rise rounded-2xl border border-border bg-surface p-4 shadow-soft">
            <div className="text-[11px] font-medium uppercase tracking-wide text-faint">{t.label}</div>
            <div className="mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.02em]">{t.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2"><Share2 size={14} className="text-accent" /><SectionLabel>Node kinds</SectionLabel></div>
          <Bars data={stats.node_kinds} color={(k) => KIND_COLOR[k] ?? "var(--accent)"} />
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2"><GitFork size={14} className="text-accent" /><SectionLabel>Relations</SectionLabel></div>
          <Bars data={stats.relations} color={() => "var(--accent)"} />
        </Card>
      </div>
      <Card className="p-5">
        <div className="text-[13.5px] font-semibold">How the graph works</div>
        <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
          The knowledge graph links technologies, vendors, capabilities, risks, migration mappings, architecture patterns and documents.
          It is a NetworkX multi-directed graph persisted locally as JSON and rebuilt whenever the ontology or knowledge base changes.
          Access goes through a small graph interface, so a Neo4j backend can be swapped in without touching the rest of the app.
          It powers the “knowledge graph path” in global search and the neighbourhood on every technology page.
        </p>
      </Card>
    </div>
  );
}
