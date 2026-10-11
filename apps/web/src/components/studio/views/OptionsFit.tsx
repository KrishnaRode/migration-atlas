"use client";
// "Which option fits best?" — deterministic fit to the stated priorities, plus the local AI's recommendation.
import { ArrowRight, Info, RefreshCw, Sparkles, Star, Wand2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import { useStudio } from "@/lib/studio-store";
import type { OptionAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_TONE: Record<string, string> = { critical: "var(--bad)", high: "var(--warn)", medium: "var(--accent)", low: "var(--faint)" };

function Dots({ score }: { score: number }) {
  const color = score >= 3 ? "var(--ok)" : score === 2 ? "var(--accent)" : score === 1 ? "var(--warn)" : "var(--bad)";
  return (
    <span className="inline-flex gap-[3px]" aria-label={`${score} of 3`}>
      {[1, 2, 3].map((i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: i <= score ? color : "var(--surface-3)" }} />)}
    </span>
  );
}

export function OptionsFit() {
  const project = useStudio((s) => s.project);
  const analysing = useStudio((s) => s.analysing);
  const analysis = project?.option_analysis as OptionAnalysis | null | undefined;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!project) return null;

  const generateAlternatives = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.options(project.estate, false, 3);
      const existing = new Set(project.options.map((o) => o.meta.variant));
      const fresh = res.options.filter((o) => !existing.has(o.meta.variant));
      await useStudio.getState().setOptions(fresh.length ? fresh : res.options.slice(1), null, "append");
      await useStudio.getState().refreshAnalysis(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  if (project.options.length < 2) {
    return (
      <div className="rounded-[24px] border border-border bg-surface p-8 text-center shadow-soft">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Wand2 size={22} /></div>
        <div className="mt-4 text-[20px] font-semibold tracking-[-0.02em]">Explore alternative architectures</div>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">
          Generate an alternative data platform and a low-rewrite path for the same estate, scored against your priorities.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" icon={Sparkles} loading={generating} onClick={generateAlternatives}>Generate alternatives</Button>
          <Button onClick={() => useStudio.getState().set({ whatIfOpen: true })}>What if…?</Button>
        </div>
        {error && <div className="mx-auto mt-4 max-w-md text-left"><ErrorNote message={error} /></div>}
      </div>
    );
  }

  const fits = analysis?.fits || [];
  const best = fits.find((f) => f.option_id === analysis?.recommended_option_id);
  const criteria = fits[0]?.criteria || [];
  const open = (id: string) => { useStudio.getState().switchOption(id); useStudio.getState().setView("canvas"); };

  return (
    <div className="space-y-5">
      {best && analysis && (
        <div className="relative overflow-hidden rounded-[24px] border border-border bg-surface p-6 shadow-soft animate-rise">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 120% at 100% 0%, rgb(0 160 125 / 0.08), transparent 60%)" }} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-[720px]">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-modern">
                <Star size={13} fill="currentColor" /> Best fit for your priorities
                {analysis.decided_by.startsWith("rules+ai") ? <Badge color="var(--accent)"><Sparkles size={10} /> Local AI + rules</Badge> : <Badge>Rule-based</Badge>}
              </div>
              <div className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.025em]">{best.name}</div>
              <div className="mt-1 text-[14px] text-muted">{analysis.headline}</div>
              {analysis.rationale && <p className="mt-3 text-[14px] leading-relaxed">{analysis.rationale}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-[44px] font-semibold leading-none tracking-[-0.04em] text-modern tabular-nums">{best.fit_percent}%</div>
              <div className="text-[11px] text-faint">fit to stated priorities</div>
              <div className="mt-1 flex gap-2">
                <Button size="sm" icon={RefreshCw} loading={analysing} onClick={() => useStudio.getState().refreshAnalysis(true)}>Re-analyse with AI</Button>
                <Button size="sm" variant="primary" onClick={() => open(best.option_id)}>Open <ArrowRight size={13} /></Button>
              </div>
            </div>
          </div>
          {analysis.caveats.length > 0 && (
            <div className="relative mt-4 flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-muted">
              <Info size={13} className="mt-0.5 shrink-0" /> <span>{analysis.caveats.join(" ")}</span>
            </div>
          )}
        </div>
      )}

      {fits.length > 0 && (
        <div className="overflow-x-auto rounded-[24px] border border-border bg-surface shadow-soft">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="w-[230px] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Your priorities</th>
                {fits.map((f) => (
                  <th key={f.option_id} className={cn("px-5 py-4 align-top", f.option_id === best?.option_id && "bg-modern-soft/50")}>
                    <button onClick={() => open(f.option_id)} className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-2 text-[11px] font-bold">{f.label}</span>
                        <span className="text-[14px] font-semibold hover:text-accent">{f.name.replace(/^Option [A-Z] · /, "")}</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span className={cn("text-[24px] font-semibold tracking-[-0.03em] tabular-nums", f.option_id === best?.option_id ? "text-modern" : "text-text")}>{f.fit_percent}%</span>
                        <span className="text-[11px] text-faint">{f.component_count} components · {f.high_findings} high findings</span>
                      </div>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, ci) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 align-top">
                    <div className="font-medium">{c.name}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: c.baseline ? "var(--faint)" : PRIORITY_TONE[c.priority] }}>
                      {c.baseline ? "baseline · not stated" : `${c.priority} priority`}
                    </div>
                  </td>
                  {fits.map((f) => {
                    const cell = f.criteria[ci];
                    const key = `${f.option_id}-${c.id}`;
                    return (
                      <td key={f.option_id} className={cn("cursor-pointer px-5 py-3 align-top", f.option_id === best?.option_id && "bg-modern-soft/30")}
                        onClick={() => setExpanded(expanded === key ? null : key)}>
                        <Dots score={cell?.score ?? 0} />
                        <div className={cn("mt-1.5 text-[12px] leading-snug text-muted", expanded !== key && "line-clamp-2")}>{cell?.evidence}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="px-5 py-3 align-top text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Choose this when</td>
                {fits.map((f) => (
                  <td key={f.option_id} className="px-5 py-3 align-top text-[12.5px] leading-relaxed">{analysis?.choose_when[f.option_id] || f.summary}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {!fits.length && (
        <div className="flex items-center justify-between rounded-[20px] border border-border bg-surface p-5 text-[13px] text-muted">
          Fit analysis hasn&apos;t been run for these options yet.
          <Button size="sm" variant="primary" loading={analysing} onClick={() => useStudio.getState().refreshAnalysis(true)}>Analyse fit</Button>
        </div>
      )}
    </div>
  );
}
