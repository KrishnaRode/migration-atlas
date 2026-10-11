"use client";
import { ArrowRight, ExternalLink, Link2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Card, SectionLabel } from "@/components/ui";
import type { MigrationMapping, Strategy, TechCard, TechnologyDetail } from "@/lib/types";
import { AutomationBadge, Chip, TechRef, humanize } from "./primitives";

export function DetailSection({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={`animate-rise p-5 ${className ?? ""}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </div>
      {children}
    </Card>
  );
}

export function BulletList({ items, color = "var(--accent)" }: { items: string[]; color?: string }) {
  return (
    <ul className="space-y-1.5 text-[13px] leading-relaxed text-muted">
      {items.map((it) => (
        <li key={it} className="flex gap-2.5"><span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />{it}</li>
      ))}
    </ul>
  );
}

export function StrategyCard({ s }: { s: Strategy }) {
  const riskColor = s.risk_level === "high" ? "var(--bad)" : s.risk_level === "medium" ? "var(--warn)" : "var(--ok)";
  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] font-semibold">{s.name}</span>
        <Badge color={riskColor}>{humanize(s.risk_level)} risk</Badge>
        <Badge>{humanize(s.typical_effort)} effort</Badge>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{s.summary}</p>
      {s.when_to_use.length > 0 && <p className="mt-1.5 text-[11.5px] text-faint">When: {s.when_to_use.slice(0, 3).join(" · ")}</p>}
    </div>
  );
}

export function MappingDetail({ m, lookup }: { m: MigrationMapping; lookup: (id: string) => TechCard | undefined }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-[13.5px] font-semibold">{m.title}</div>
        <AutomationBadge level={m.automation_potential} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
        <TechRef id={m.source} tech={lookup(m.source)} />
        {m.source_artifact && <span className="text-[11px] text-faint">({m.source_artifact})</span>}
        <ArrowRight size={13} className="text-faint" />
        {m.targets.map((t) => <TechRef key={t} id={t} tech={lookup(t)} />)}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {m.approaches.length > 0 && <div><SectionLabel className="mb-1.5">Approaches</SectionLabel><BulletList items={m.approaches} /></div>}
        {m.conversion_considerations.length > 0 && <div><SectionLabel className="mb-1.5">Conversion considerations</SectionLabel><BulletList items={m.conversion_considerations} color="var(--info)" /></div>}
      </div>
      {m.manual_effort_areas.length > 0 && (
        <div className="mt-3">
          <SectionLabel className="mb-1.5">Manual effort areas</SectionLabel>
          <div className="flex flex-wrap gap-1">{m.manual_effort_areas.map((x) => <Badge key={x} color="var(--warn)">{x}</Badge>)}</div>
        </div>
      )}
    </div>
  );
}

const RELATION_LABEL: Record<string, string> = {
  PROVIDES: "Provides", REPLACES: "Replaces", CONNECTS_TO: "Connects to", MIGRATES_TO: "Migrates to", DEPENDS_ON: "Depends on",
  ALTERNATIVE_TO: "Alternative to", DOCUMENTED_BY: "Documented by", SUPPORTS: "Supports mapping", REQUIRES: "Requires",
  MADE_BY: "Made by", HAS_RISK: "Has risk", PART_OF: "Part of pattern",
};

const KIND_LABEL: Record<string, string> = {
  Technology: "tech", Vendor: "vendor", Capability: "capability", Risk: "risk", MigrationPattern: "mapping",
  ArchitecturePattern: "pattern", Documentation: "doc",
};

export function GraphNeighbourhood({ graph }: { graph: TechnologyDetail["graph"] }) {
  const groups = new Map<string, TechnologyDetail["graph"]>();
  for (const g of graph) {
    const key = `${g.relation}|${g.direction}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  const href = (id: string, kind: string) =>
    kind === "technology" || id.startsWith("tech:") ? `/technologies/${id.replace(/^tech:/, "")}`
      : kind === "pattern" || id.startsWith("pattern:") ? `/patterns#${id.replace(/^pattern:/, "")}` : null;
  return (
    <div className="space-y-2.5">
      {[...groups.entries()].map(([key, items]) => {
        const [rel, dir] = key.split("|");
        const label = `${RELATION_LABEL[rel ?? ""] ?? humanize(rel ?? "")}${dir === "in" ? " (inbound)" : ""}`;
        return (
          <div key={key} className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
            <div className="w-40 shrink-0 pt-1 font-mono text-[10.5px] uppercase tracking-wide text-faint">{label}</div>
            <div className="flex flex-wrap gap-1">
              {items.map((it, i) => {
                const h = href(it.id, it.kind);
                const chip = <Chip className="py-0.5"><span className="text-[10px] text-faint">{KIND_LABEL[it.kind] ?? it.kind}</span>{it.label}</Chip>;
                return h ? <Link key={`${it.id}-${i}`} href={h} className="transition-opacity hover:opacity-75">{chip}</Link> : <span key={`${it.id}-${i}`}>{chip}</span>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DocLinks({ docs }: { docs: TechnologyDetail["docs"] }) {
  return (
    <div className="space-y-1.5">
      {docs.map((d) => (
        <a key={d.url} href={d.url} target="_blank" rel="noreferrer"
          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-2">
          <Link2 size={13} className="shrink-0 text-faint" />
          <span className="flex-1 truncate font-medium group-hover:text-accent">{d.title}</span>
          <ExternalLink size={12} className="shrink-0 text-faint" />
        </a>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-5"><div className="shimmer h-20 w-20 rounded-2xl" /><div className="flex-1 space-y-3 pt-2"><div className="shimmer h-7 w-1/3 rounded" /><div className="shimmer h-4 w-1/4 rounded" /><div className="shimmer h-4 w-2/3 rounded" /></div></div>
      <div className="grid gap-5 lg:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-40 rounded-2xl" />)}</div>
    </div>
  );
}
