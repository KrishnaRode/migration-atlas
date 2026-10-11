"use client";
import { Columns2, GitBranch, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useStudio } from "@/lib/studio-store";
import type { CompareResult } from "@/lib/types";
import { CLOUD_NAMES, LAYER_NAMES } from "@/lib/utils";
import { Markdown } from "../panels/Markdown";

const LEVEL_COLOR: Record<string, string> = { strong: "var(--ok)", partial: "var(--warn)", weak: "var(--bad)", "not-assessed": "var(--faint)" };

export function CompareView() {
  const options = useStudio((s) => s.project?.options) || [];
  const activeId = useStudio((s) => s.activeId);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (narrative = false) => {
    const st = useStudio.getState();
    const opts = st.project!.options.map((o) => (o.id === st.activeId ? st.architecture()! : o));
    setBusy(true);
    setError(null);
    try { setResult(await api.compare(opts, st.project?.estate, st.persona, narrative)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  useEffect(() => { if (options.length >= 2) void run(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [options.length]);
  if (options.length < 2) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState icon={Columns2} title="One option so far" body="Create an alternative with What if… (e.g. 'What if we use BigQuery instead?') to compare architectures side by side."
          action={<Button variant="primary" icon={GitBranch} onClick={() => useStudio.getState().set({ whatIfOpen: true })}>What if…?</Button>} />
      </div>
    );
  }
  const rows: { label: string; render: (o: CompareResult["options"][number]) => React.ReactNode }[] = [
    { label: "Target", render: (o) => <span>{CLOUD_NAMES[o.target_cloud || ""] || "—"} · {o.data_platform || "—"}</span> },
    { label: "Components", render: (o) => <span>{o.component_count} components · {o.connection_count} connections</span> },
    { label: "Unique to this option", render: (o) => <div className="flex flex-wrap gap-1">{o.unique_components.map((c) => <Badge key={c} color="var(--accent)">{c}</Badge>)}{!o.unique_components.length && "—"}</div> },
    { label: "Components by layer", render: (o) => <div className="space-y-0.5">{Object.entries(o.components_by_layer).map(([l, v]) => <div key={l}><span className="text-faint">{LAYER_NAMES[l] || l}:</span> {v.join(", ")}</div>)}</div> },
    { label: "Likely rewrite areas", render: (o) => <div className="space-y-0.5">{o.rewrite_areas.map((r, i) => <div key={i}>{r.from} → {r.to} <span className="text-faint">({r.automation_potential} automation)</span></div>)}{!o.rewrite_areas.length && "—"}</div> },
    { label: "Operational model", render: (o) => <div className="flex flex-wrap gap-1">{Object.entries(o.operational_model).map(([k, v]) => <Badge key={k}>{v} {k}</Badge>)}</div> },
    { label: "Governance approach", render: (o) => o.governance_approach.join(", ") },
    { label: "Skills needed", render: (o) => <div className="flex flex-wrap gap-1">{o.skills_needed.map((s) => <Badge key={s}>{s}</Badge>)}</div> },
    { label: "Complexity drivers", render: (o) => <ul className="space-y-0.5">{o.complexity_drivers.map((c) => <li key={c}>• {c}</li>)}</ul> },
    { label: "Retained legacy (coexistence)", render: (o) => o.retained_legacy.join(", ") || "—" },
    { label: "Potential risks", render: (o) => <ul className="space-y-0.5">{[...o.risks, ...o.validation.top].slice(0, 6).map((c, i) => <li key={i}>• {c}</li>)}</ul> },
    { label: "Health", render: (o) => <div className="space-y-0.5">{o.health.map((h) => <div key={h.id} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL_COLOR[h.level] }} />{h.name}: {h.level}</div>)}</div> },
  ];
  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-8 py-8">
      <div className="flex items-start justify-between">
        <div><div className="text-[12px] font-medium text-accent">Compare</div><h2 className="text-[26px] font-semibold tracking-tight">Architecture options side by side</h2>
          <p className="mt-1 text-[13.5px] text-muted">Descriptive, not a scoreboard — each option fits different priorities.</p></div>
        <Button size="sm" icon={Sparkles} loading={busy} onClick={() => run(true)}>AI comparison narrative</Button>
      </div>
      {error && <ErrorNote message={error} onRetry={() => run(false)} />}
      {result?.narrative && <div className="rounded-2xl bg-surface-2 p-4"><Markdown text={result.narrative} /></div>}
      {!result && busy && <div className="flex items-center gap-2 text-[13px] text-muted"><Spinner /> Comparing…</div>}
      {result && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
          <table className="w-full min-w-[900px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border">
                <th className="w-[180px] px-4 py-3" />
                {result.options.map((o) => (
                  <th key={o.id} className="px-4 py-3 align-top">
                    <button onClick={() => { useStudio.getState().switchOption(o.id); useStudio.getState().setView("canvas"); }} className="text-left">
                      <div className="text-[14px] font-semibold hover:text-accent">{o.name}</div>
                      {o.id === activeId && <Badge color="var(--accent)">active</Badge>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 align-top text-[11.5px] font-semibold uppercase tracking-wider text-faint">{r.label}</td>
                  {result.options.map((o) => <td key={o.id} className="px-4 py-3 align-top text-muted">{r.render(o)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result && <div className="text-[12px] text-faint">Shared by all options: {result.shared_components.join(", ") || "—"}</div>}
    </div>
  );
}
