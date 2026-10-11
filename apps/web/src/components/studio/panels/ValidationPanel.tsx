"use client";
import { CheckCircle2, ChevronRight, CircleDashed, ShieldCheck, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge, Button, EmptyState, SectionLabel } from "@/components/ui";
import { useStudio } from "@/lib/studio-store";
import type { HealthDimension, Severity, ValidationFinding } from "@/lib/types";
import { cn, SEVERITY_COLOR, SEVERITY_ORDER } from "@/lib/utils";
import { ProposalCard } from "./ProposalCard";

const LEVEL: Record<HealthDimension["level"], { label: string; color: string; pct: (d: HealthDimension) => number }> = {
  strong: { label: "Strong", color: "var(--ok)", pct: (d) => d.passed / Math.max(1, d.applicable) },
  partial: { label: "Partial", color: "var(--warn)", pct: (d) => d.passed / Math.max(1, d.applicable) },
  weak: { label: "Weak", color: "var(--bad)", pct: (d) => d.passed / Math.max(1, d.applicable) },
  "not-assessed": { label: "Not assessed", color: "var(--faint)", pct: () => 0 },
};

export function HealthPanel({ health }: { health: HealthDimension[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      {health.map((d) => {
        const meta = LEVEL[d.level];
        const isOpen = open === d.id;
        return (
          <div key={d.id} className="rounded-xl border border-border bg-surface">
            <button onClick={() => setOpen(isOpen ? null : d.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-medium">{d.name}</span>
                  <span className="text-[11px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(meta.pct(d) * 100)}%`, background: meta.color }} />
                </div>
              </div>
              <ChevronRight size={14} className={cn("text-faint transition-transform", isOpen && "rotate-90")} />
            </button>
            {isOpen && (
              <div className="space-y-1 border-t border-border px-3 py-2">
                <div className="text-[11px] text-faint">{d.summary} Evidence:</div>
                {d.evidence.map((e, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11.5px]">
                    {e.passed ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-ok" /> : <XCircle size={13} className="mt-0.5 shrink-0 text-bad" />}
                    <div><span className="font-medium">{e.check}.</span> <span className="text-muted">{e.detail}</span></div>
                  </div>
                ))}
                {!d.evidence.length && <div className="flex items-center gap-1.5 text-[11.5px] text-faint"><CircleDashed size={13} /> Nothing to assess yet.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ValidationPanel() {
  const validation = useStudio((s) => s.validation);
  const validating = useStudio((s) => s.validating);
  const [sev, setSev] = useState<Severity | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  if (!validation) {
    return <EmptyState icon={ShieldCheck} title="No validation yet" body="Validation runs automatically as you edit the architecture."
      action={<Button size="sm" variant="primary" loading={validating} onClick={() => useStudio.getState().validate()}>Validate now</Button>} />;
  }
  const findings = validation.findings.filter((f) => !sev || f.severity === sev);
  const focus = (f: ValidationFinding) => {
    setExpanded(expanded === f.id ? null : f.id);
    const st = useStudio.getState();
    if (f.node_ids[0]) st.set({ nodes: st.nodes.map((n) => ({ ...n, selected: f.node_ids.includes(n.id) })), selectedNodeId: f.node_ids[0], selectedEdgeId: null });
    else if (f.edge_ids[0]) st.select(null, f.edge_ids[0]);
  };
  return (
    <div className="space-y-4 p-3">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Architecture health</SectionLabel>
          <button onClick={() => useStudio.getState().validate()} className="flex items-center gap-1 text-[11px] text-faint hover:text-text">
            <RefreshCw size={11} className={validating ? "animate-spin" : ""} /> Re-run
          </button>
        </div>
        <HealthPanel health={validation.health} />
        <div className="mt-1.5 text-[10.5px] text-faint">Separate, explainable dimensions — deliberately no single overall score.</div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Findings · {validation.findings.length}</SectionLabel>
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          {SEVERITY_ORDER.map((s) => (
            <button key={s} onClick={() => setSev(sev === s ? null : s)}
              className={cn("inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium capitalize transition-colors",
                sev === s ? "border-transparent bg-surface-3 text-text" : "border-border text-muted hover:text-text")}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_COLOR[s] }} /> {s} {validation.counts[s] || 0}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {findings.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-surface">
              <button onClick={() => focus(f)} className="flex w-full items-start gap-2.5 px-3 py-2 text-left">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[f.severity] }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium leading-snug">{f.title}</div>
                  <div className="mt-0.5 flex gap-1"><Badge color={SEVERITY_COLOR[f.severity]}>{f.severity}</Badge><Badge>{f.category}</Badge></div>
                </div>
              </button>
              {expanded === f.id && (
                <div className="space-y-2 border-t border-border px-3 py-2.5 text-[12px]">
                  <div className="text-muted">{f.detail}</div>
                  {f.recommendation && <div><span className="font-medium">Recommendation: </span><span className="text-muted">{f.recommendation}</span></div>}
                  {f.evidence.length > 0 && <div className="text-[11px] text-faint">Evidence: {f.evidence.join(" · ")}</div>}
                  <div className="text-[10.5px] text-faint">Rule {f.rule_id} · deterministic</div>
                  {f.proposal && !dismissed.includes(f.proposal.id) && (
                    <ProposalCard proposal={f.proposal} onDismiss={() => setDismissed([...dismissed, f.proposal!.id])} />
                  )}
                </div>
              )}
            </div>
          ))}
          {!findings.length && <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-[12px] text-faint">No findings at this severity.</div>}
        </div>
      </div>
    </div>
  );
}
