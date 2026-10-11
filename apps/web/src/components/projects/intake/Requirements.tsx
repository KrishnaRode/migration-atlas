"use client";
import { ChevronDown } from "lucide-react";
import type { ConstraintDef, MigrationConstraint, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { INDUSTRIES, PRIORITY_CYCLE, PRIORITY_LABEL } from "./estate";

// Visual intensity grows with priority: tinted → solid.
const STYLE: Record<Priority, { bg: string; border: string; text: string; dots: number }> = {
  low: { bg: "color-mix(in srgb, var(--accent) 6%, var(--surface))", border: "color-mix(in srgb, var(--accent) 25%, var(--border))", text: "var(--text)", dots: 1 },
  medium: { bg: "color-mix(in srgb, var(--accent) 13%, var(--surface))", border: "color-mix(in srgb, var(--accent) 45%, transparent)", text: "var(--text)", dots: 2 },
  high: { bg: "color-mix(in srgb, var(--accent) 24%, var(--surface))", border: "var(--accent)", text: "var(--text)", dots: 3 },
  critical: { bg: "var(--accent)", border: "var(--accent)", text: "#fff", dots: 4 },
};

export function RequirementsPicker({ defs, value, onChange, error }: {
  defs: ConstraintDef[] | null; value: MigrationConstraint[]; onChange: (next: MigrationConstraint[]) => void; error: string | null;
}) {
  if (error) return <div className="text-[12px] text-faint">Requirements load from the local backend.</div>;
  if (!defs) return <div className="flex flex-wrap gap-1.5">{Array.from({ length: 8 }).map((_, k) => <div key={k} className="shimmer h-7 w-28 rounded-full" />)}</div>;

  const cycle = (id: string) => {
    const cur = value.find((c) => c.id === id)?.priority ?? null;
    const next = PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(cur) + 1) % PRIORITY_CYCLE.length];
    onChange(next ? (cur ? value.map((c) => (c.id === id ? { ...c, priority: next } : c)) : [...value, { id, priority: next }]) : value.filter((c) => c.id !== id));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {defs.map((d) => {
          const pr = value.find((c) => c.id === d.id)?.priority;
          const s = pr ? STYLE[pr] : null;
          return (
            <button key={d.id} onClick={() => cycle(d.id)} title={pr ? `${PRIORITY_LABEL[pr]} priority — click to raise` : "Click to add"}
              className={cn("inline-flex h-7 items-center gap-2 rounded-full border px-3 text-[12px] font-medium transition-all duration-150 active:scale-[0.97]",
                !s && "border-border bg-surface text-muted hover:border-border-strong hover:text-text")}
              style={s ? { background: s.bg, borderColor: s.border, color: s.text } : undefined}>
              {d.name}
              {pr && (
                <span className="inline-flex items-center gap-1 animate-fade">
                  <span className="flex gap-[2px]">
                    {[1, 2, 3, 4].map((k) => (
                      <span key={k} className="h-2.5 w-[3px] rounded-full" style={{ background: "currentColor", opacity: k <= STYLE[pr].dots ? 0.9 : 0.2 }} />
                    ))}
                  </span>
                  <span className="text-[10.5px] opacity-80">{PRIORITY_LABEL[pr]}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-faint">Click a requirement to add it; click again to raise priority: Low → Medium → High → Critical → off.</p>
    </div>
  );
}

export function EstateDetails({ volume, industry, onVolume, onIndustry }: {
  volume: number | null | undefined; industry: string | null | undefined; onVolume: (v: number | null) => void; onIndustry: (v: string | null) => void;
}) {
  const field = "h-10 w-full rounded-xl border border-border bg-surface px-3 text-[13px] text-text outline-none transition-colors focus:border-accent";
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="mb-1.5 block text-[11.5px] font-medium text-muted">Data volume</span>
        <div className="relative">
          <input type="number" min={0} inputMode="decimal" value={volume ?? ""} placeholder="e.g. 300"
            onChange={(e) => { const n = parseFloat(e.target.value); onVolume(Number.isFinite(n) && n >= 0 ? n : null); }}
            className={cn(field, "pr-10 tabular-nums")} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-faint">TB</span>
        </div>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[11.5px] font-medium text-muted">Industry</span>
        <div className="relative">
          <select value={industry ?? ""} onChange={(e) => onIndustry(e.target.value || null)} className={cn(field, "appearance-none pr-8")}>
            <option value="">Select…</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            {industry && !INDUSTRIES.includes(industry) && <option value={industry}>{industry}</option>}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
        </div>
      </label>
    </div>
  );
}
