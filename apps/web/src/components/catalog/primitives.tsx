"use client";
// Small building blocks shared by the technology catalogue, details page and pattern library.
import { ArrowRight, ExternalLink, FileText, ShieldAlert, Wand2 } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Badge, Card, SectionLabel, TechIcon } from "@/components/ui";
import type { Category, MigrationMapping, RiskDef, SearchHit, TechCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export const stagger = (i: number, step = 35, max = 600): CSSProperties => ({ animationDelay: `${Math.min(i * step, max)}ms` });

export const AUTOMATION_COLOR: Record<string, string> = { high: "var(--ok)", medium: "var(--warn)", low: "var(--bad)" };

export function humanize(s: string): string {
  return s.replace(/[_-]+/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function LegacyBadge({ legacy }: { legacy: boolean }) {
  return legacy ? <Badge color="var(--legacy)">Legacy</Badge> : <Badge color="var(--modern)">Modern</Badge>;
}

export function AutomationBadge({ level }: { level: string }) {
  return <Badge color={AUTOMATION_COLOR[level] || "var(--muted)"}><Wand2 size={10} /> {humanize(level)} automation</Badge>;
}

export function Chip({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span style={style} className={cn("inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2 py-1 text-[11.5px] font-medium text-muted", className)}>
      {children}
    </span>
  );
}

export function TechTile({ tech, category, index = 0 }: { tech: TechCard; category?: Category; index?: number }) {
  return (
    <Link href={`/technologies/${tech.id}`} style={stagger(index)}
      className="group flex animate-rise flex-col rounded-2xl border border-border bg-surface p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift">
      <div className="flex items-start gap-3">
        <TechIcon icon={tech.icon} color={tech.color} muted={tech.legacy} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold tracking-[-0.01em] group-hover:text-accent">{tech.name}</div>
          <div className="truncate text-[12px] text-faint">{tech.vendor}</div>
        </div>
        <ArrowRight size={15} className="mt-1 shrink-0 text-faint opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <LegacyBadge legacy={tech.legacy} />
        {category && <Badge color={category.color}>{category.name}</Badge>}
      </div>
      {tech.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tech.capabilities.slice(0, 3).map((c) => (
            <span key={c} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-muted">{c}</span>
          ))}
        </div>
      )}
    </Link>
  );
}

/** Compact clickable tech reference used in detail sections. */
export function TechLink({ tech, sub }: { tech: TechCard; sub?: ReactNode }) {
  return (
    <Link href={`/technologies/${tech.id}`}
      className="group flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-soft">
      <TechIcon icon={tech.icon} color={tech.color} muted={tech.legacy} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium group-hover:text-accent">{tech.name}</div>
        <div className="truncate text-[11px] text-faint">{sub ?? tech.vendor}</div>
      </div>
    </Link>
  );
}

export function TileGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex gap-3"><div className="shimmer h-[38px] w-[38px] rounded-[10px]" /><div className="flex-1 space-y-2"><div className="shimmer h-3.5 w-2/3 rounded" /><div className="shimmer h-3 w-1/3 rounded" /></div></div>
          <div className="mt-4 flex gap-1.5"><div className="shimmer h-4 w-14 rounded" /><div className="shimmer h-4 w-20 rounded" /></div>
        </div>
      ))}
    </div>
  );
}

export function MappingCard({ mapping, byId, index = 0 }: { mapping: MigrationMapping; byId: (id: string) => TechCard | undefined; index?: number }) {
  const src = byId(mapping.source);
  return (
    <div style={stagger(index, 50)} className="animate-rise">
    <Card className="h-full p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-[13.5px] font-semibold tracking-[-0.01em]">{mapping.title}</div>
        <AutomationBadge level={mapping.automation_potential} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px]">
        <TechRef id={mapping.source} tech={src} />
        <ArrowRight size={13} className="text-faint" />
        {mapping.targets.map((t) => <TechRef key={t} id={t} tech={byId(t)} />)}
      </div>
      {mapping.approaches.length > 0 && (
        <div className="mt-3">
          <SectionLabel className="mb-1">Approaches</SectionLabel>
          <ul className="space-y-1 text-[12.5px] text-muted">
            {mapping.approaches.slice(0, 2).map((a) => <li key={a} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />{a}</li>)}
          </ul>
        </div>
      )}
      {mapping.manual_effort_areas.length > 0 && (
        <div className="mt-3">
          <SectionLabel className="mb-1">Manual effort</SectionLabel>
          <div className="flex flex-wrap gap-1">{mapping.manual_effort_areas.map((m) => <Badge key={m} color="var(--warn)">{m}</Badge>)}</div>
        </div>
      )}
    </Card>
    </div>
  );
}

export function TechRef({ id, tech }: { id: string; tech?: TechCard }) {
  return (
    <Link href={`/technologies/${id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 py-0.5 pl-1 pr-2 font-medium text-text transition-colors hover:border-border-strong">
      <TechIcon icon={tech?.icon} color={tech?.color} muted={tech?.legacy} size={18} />
      {tech?.name ?? humanize(id)}
    </Link>
  );
}

export function RiskItem({ risk }: { risk: Pick<RiskDef, "id" | "title" | "description" | "mitigations"> }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold"><ShieldAlert size={14} className="text-warn" />{risk.title}</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{risk.description}</p>
      {risk.mitigations.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12px] text-muted">
          {risk.mitigations.map((m) => <li key={m} className="flex gap-2"><span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-ok" />{m}</li>)}
        </ul>
      )}
    </div>
  );
}

export function KnowledgeHit({ hit }: { hit: SearchHit }) {
  const c = hit.citation;
  const curated = c.doc_type === "curated-note";
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge color={curated ? "var(--modern)" : "var(--info)"}>{curated ? "Curated note" : c.vendor}</Badge>
        {!curated && c.doc_type && <Badge>{humanize(c.doc_type)}</Badge>}
        <span className="ml-auto text-[11px] text-faint">Retrieved {formatDate(c.retrieved_at)}</span>
      </div>
      <div className="mt-2 flex items-start gap-2 text-[13px] font-medium">
        <FileText size={14} className="mt-0.5 shrink-0 text-faint" />
        {c.url && /^https?:/.test(c.url) ? (
          <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">{c.title} <ExternalLink size={11} className="inline" /></a>
        ) : <span>{c.title}</span>}
      </div>
      <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-muted">{c.snippet || hit.text}</p>
    </div>
  );
}
