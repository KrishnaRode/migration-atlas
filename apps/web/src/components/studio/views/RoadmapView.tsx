"use client";
import { ArrowRight, CalendarRange, Flag, GitFork, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, Button, EmptyState, ErrorNote, SectionLabel, TechIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { useStudio } from "@/lib/studio-store";
import type { DependencyGraph, Roadmap } from "@/lib/types";
import { cn } from "@/lib/utils";

export function useRoadmap() {
  const roadmap = useStudio((s) => (s.project?.roadmap && s.project.roadmap.architecture_id === s.activeId ? s.project.roadmap : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generate = async (narrative = false) => {
    const st = useStudio.getState();
    const arch = st.architecture();
    if (!arch) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.roadmap(arch, st.project?.estate || null, st.persona, narrative);
      st.setRoadmap(res.roadmap, res.migration_controls);
      st.toast({ title: "Migration roadmap generated", body: "Parallel run, cutover and rollback are now defined — validation updated.", tone: "ok" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { roadmap, busy, error, generate };
}

export function RoadmapView() {
  const { roadmap, busy, error, generate } = useRoadmap();
  if (!roadmap) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md">
          <EmptyState icon={CalendarRange} title="No roadmap yet" body="Generate a phased migration plan from this architecture. Waves are ordered by the dependency graph between legacy systems."
            action={<div className="space-y-2"><Button variant="primary" icon={CalendarRange} loading={busy} onClick={() => generate(false)}>Generate migration roadmap</Button>
              {error && <ErrorNote message={error} />}</div>} />
        </div>
      </div>
    );
  }
  return <RoadmapDoc roadmap={roadmap} busy={busy} onRegenerate={generate} />;
}

function RoadmapDoc({ roadmap, busy, onRegenerate }: { roadmap: Roadmap; busy: boolean; onRegenerate: (n: boolean) => void }) {
  const waves = roadmap.waves.filter((w) => w.included);
  const [open, setOpen] = useState<string | null>(waves[0]?.id || null);
  return (
    <div className="mx-auto max-w-[1100px] space-y-8 px-8 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-semibold tracking-tight">Migration roadmap</h2>
          <p className="mt-1 text-[13px] text-muted">{waves.length} waves from discovery to decommissioning, ordered by migration dependencies.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" icon={Sparkles} loading={busy} onClick={() => onRegenerate(true)}>AI narrative</Button>
          <Button size="sm" icon={RefreshCw} loading={busy} onClick={() => onRegenerate(false)}>Regenerate</Button>
        </div>
      </div>
      {roadmap.narrative && <div className="rounded-2xl bg-surface-2 p-4 text-[13px] leading-relaxed text-muted"><Sparkles size={13} className="mr-1.5 inline text-accent" />{roadmap.narrative}</div>}
      {roadmap.themes.length > 0 && (
        <div className="flex flex-wrap gap-2">{roadmap.themes.map((t) => <span key={t} className="rounded-full border border-border bg-surface px-3 py-1 text-[12px]">{t}</span>)}</div>
      )}
      {/* Timeline strip */}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-1.5">
          {waves.map((w, i) => (
            <button key={w.id} onClick={() => setOpen(w.id)}
              className={cn("group w-[150px] rounded-xl border p-2.5 text-left transition-all animate-rise", open === w.id ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong")}
              style={{ animationDelay: `${i * 40}ms` }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-faint">Wave {w.index}</div>
              <div className="mt-0.5 text-[12.5px] font-semibold leading-tight">{w.name}</div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted"><Flag size={10} /> {w.activities.length} {w.activities.length === 1 ? "activity" : "activities"}</div>
            </button>
          ))}
        </div>
      </div>
      {waves.filter((w) => w.id === open).map((w) => (
        <div key={w.id} className="grid animate-fade gap-6 md:grid-cols-[1fr_280px]">
          <div>
            <div className="text-[12px] font-medium text-accent">Wave {w.index}</div>
            <div className="text-[18px] font-semibold">{w.name}</div>
            <div className="mt-1 text-[13px] text-muted">{w.goal}</div>
            <div className="mt-4 space-y-2">
              {w.activities.map((a, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface px-3.5 py-2.5">
                  <div className="text-[13px] font-medium">{a.title}</div>
                  {a.detail && <div className="mt-0.5 text-[12px] text-muted">{a.detail}</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {w.exit_criteria.length > 0 && <div><SectionLabel>Exit criteria</SectionLabel><ul className="mt-1.5 space-y-1 text-[12px] text-muted">{w.exit_criteria.map((e) => <li key={e}>• {e}</li>)}</ul></div>}
            {w.risks.length > 0 && <div><SectionLabel>Risks</SectionLabel><div className="mt-1.5 flex flex-wrap gap-1">{w.risks.map((r) => <Badge key={r} color="var(--warn)">{r}</Badge>)}</div></div>}
            {w.skills.length > 0 && <div><SectionLabel>Skills</SectionLabel><div className="mt-1.5 flex flex-wrap gap-1">{w.skills.map((s) => <Badge key={s}>{s}</Badge>)}</div></div>}
          </div>
        </div>
      ))}
      <DependencyView graph={roadmap.dependencies} />
    </div>
  );
}

export function DependencyView({ graph }: { graph: DependencyGraph }) {
  const techIndex = useStudio((s) => s.techIndex);
  const legacy = graph.order.map((id) => graph.nodes.find((n) => n.id === id)).filter(Boolean) as DependencyGraph["nodes"];
  if (!legacy.length) return null;
  const targetsOf = (id: string) => graph.edges.filter((e) => e.source === id && e.relation === "migrates_to")
    .map((e) => graph.nodes.find((n) => n.id === e.target)).filter(Boolean) as DependencyGraph["nodes"];
  const deps = (id: string) => graph.edges.filter((e) => e.target === id && e.relation !== "migrates_to")
    .map((e) => ({ rel: e.relation, node: graph.nodes.find((n) => n.id === e.source) })).filter((d) => d.node);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2"><GitFork size={15} className="text-accent" /><h3 className="text-[16px] font-semibold">Migration dependency graph</h3></div>
      <p className="mb-4 text-[12.5px] text-muted">Legacy systems in the order they need to move. Each row shows what it depends on and what it migrates to.</p>
      <div className="space-y-2">
        {legacy.map((n, i) => {
          const t = techIndex[n.tech_id];
          return (
            <div key={n.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">{i + 1}</span>
              <TechIcon icon={t?.icon} color={t?.color} size={28} muted />
              <div className="w-[180px] min-w-0">
                <div className="truncate text-[13px] font-medium">{n.label}</div>
                <div className="text-[11px] text-faint">{n.wave != null ? `Wave ${n.wave}` : ""}{deps(n.id).length ? ` · after ${deps(n.id).map((d) => d.node!.label).join(", ")}` : ""}</div>
              </div>
              <ArrowRight size={15} className="shrink-0 text-faint" />
              <div className="flex flex-1 flex-wrap gap-1.5">
                {targetsOf(n.id).map((tn) => {
                  const tt = techIndex[tn.tech_id];
                  return <span key={tn.id} className="inline-flex items-center gap-1.5 rounded-lg bg-modern-soft px-2 py-1 text-[12px] font-medium text-modern"><TechIcon icon={tt?.icon} color={tt?.color} size={18} />{tn.label}</span>;
                })}
                {!targetsOf(n.id).length && <span className="text-[12px] text-faint">Retained / no direct target</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
