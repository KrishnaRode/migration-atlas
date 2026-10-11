"use client";
import { Check, CircleMinus, Link2, Play, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge, Button, ErrorNote, SectionLabel, TechIcon } from "@/components/ui";
import { api } from "@/lib/api";
import type { Pattern, TechCard } from "@/lib/types";
import { PatternDiagram } from "./pattern-diagram";
import { stagger } from "./primitives";

function ListBlock({ title, items, icon, color }: { title: string; items: string[]; icon: ReactNode; color: string }) {
  if (!items.length) return null;
  return (
    <div>
      <SectionLabel className="mb-2">{title}</SectionLabel>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className="flex gap-2 text-[12.5px] leading-relaxed text-muted">
            <span className="mt-[3px] shrink-0" style={{ color }}>{icon}</span>{it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PatternCard({ pattern, byId, index, highlighted }: {
  pattern: Pattern; byId: (id: string) => TechCard | undefined; index: number; highlighted: boolean;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setOpening(true);
    setError(null);
    try {
      const arch = await api.instantiatePattern(pattern.id);
      const project = await api.createProject({
        name: pattern.name, description: pattern.summary,
        estate: {
          description: "", current_technologies: [], target_platforms: [], constraints: [], notes: [],
          retain_technologies: [], exclude_technologies: [], target_cloud: arch.meta.target_cloud ?? null,
        },
      });
      await api.saveProject({ ...project, options: [arch], active_option_id: arch.id });
      router.push(`/studio/${project.id}`);
    } catch (e) {
      setError((e as Error).message);
      setOpening(false);
    }
  };

  return (
    <article id={pattern.id} style={stagger(index, 70)}
      className={`scroll-mt-24 animate-rise rounded-2xl border bg-surface p-6 shadow-soft transition-shadow hover:shadow-lift ${highlighted ? "border-accent ring-4 ring-accent-soft" : "border-border"}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="flex items-center gap-2">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{pattern.name}</h2>
            <a href={`#${pattern.id}`} title="Link to this pattern" className="text-faint opacity-60 hover:text-accent hover:opacity-100"><Link2 size={14} /></a>
          </div>
          <p className="mt-1 text-[14px] font-medium text-muted">{pattern.summary}</p>
          {pattern.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">{pattern.tags.map((t) => <Badge key={t} color="var(--accent)">{t}</Badge>)}</div>
          )}
        </div>
        <Button variant="primary" icon={Play} loading={opening} onClick={open} className="shrink-0">Open in studio</Button>
      </div>
      {error && <div className="mt-4"><ErrorNote message={error} onRetry={open} /></div>}

      <p className="mt-4 max-w-4xl text-[13px] leading-relaxed text-muted">{pattern.description}</p>

      <div className="mt-5"><PatternDiagram pattern={pattern} byId={byId} /></div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <ListBlock title="Suitable scenarios" items={pattern.suitable_scenarios} icon={<Target size={12} />} color="var(--info)" />
        <ListBlock title="Benefits" items={pattern.benefits} icon={<Check size={12} />} color="var(--ok)" />
        <ListBlock title="Limitations" items={pattern.limitations} icon={<CircleMinus size={12} />} color="var(--warn)" />
      </div>

      {pattern.components.length > 0 && (
        <div className="mt-6">
          <SectionLabel className="mb-2">Components</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {pattern.components.map((cid) => {
              const t = byId(cid);
              return (
                <Link key={cid} href={`/technologies/${cid}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface py-1 pl-1 pr-2.5 text-[12px] font-medium transition-all hover:border-border-strong hover:bg-surface-2">
                  <TechIcon icon={t?.icon} color={t?.color} muted={t?.legacy} size={20} className="rounded-md" />
                  {t?.name ?? cid}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}
