"use client";
import { ArrowLeft, ArrowRight, Cloud, LayoutTemplate, Plus, Server } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { KnowledgeHit, LegacyBadge, RiskItem, TechLink, humanize } from "@/components/catalog/primitives";
import {
  BulletList, DetailSection, DetailSkeleton, DocLinks, GraphNeighbourhood, MappingDetail, StrategyCard,
} from "@/components/catalog/tech-detail-sections";
import { PageShell } from "@/components/shell";
import { Badge, ErrorNote, LinkButton, SectionLabel, TechIcon } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { useOntology } from "@/lib/ontology";
import type { TechCard, TechnologyDetail } from "@/lib/types";
import { CLOUD_NAMES, LAYER_NAMES } from "@/lib/utils";

export default function TechnologyPage() {
  const { id } = useParams<{ id: string }>();
  const { byId } = useOntology();
  const [tech, setTech] = useState<TechnologyDetail | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);

  const load = useCallback(() => {
    setError(null);
    setTech(null);
    api.technology(id)
      .then(setTech)
      .catch((e: ApiError) => setError({ message: e.status === 404 ? `We couldn't find a technology called “${id}”.` : e.message, notFound: e.status === 404 }));
  }, [id]);
  useEffect(load, [load]);

  return (
    <PageShell>
      <Link href="/technologies" className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-text">
        <ArrowLeft size={14} /> Technology catalogue
      </Link>
      {error ? (
        <div className="mx-auto max-w-xl space-y-4">
          <ErrorNote message={error.message} onRetry={error.notFound ? undefined : load} />
          {error.notFound && <LinkButton href="/technologies" icon={ArrowLeft}>Browse all technologies</LinkButton>}
        </div>
      ) : !tech ? <DetailSkeleton /> : <Detail tech={tech} byId={byId} />}
    </PageShell>
  );
}

function Detail({ tech, byId }: { tech: TechnologyDetail; byId: (id: string) => TechCard | undefined }) {
  const all = [...tech.possible_targets_detail, ...tech.alternatives_detail, ...tech.replaces_detail, ...tech.replaced_by, ...tech.related, ...tech.suggested_next_detail];
  const lookup = (tid: string) => (tid === tech.id ? tech : all.find((t) => t.id === tid) ?? byId(tid));
  const modern = [...tech.alternatives_detail, ...tech.replaced_by.filter((r) => !tech.alternatives_detail.some((a) => a.id === r.id))];
  const cat = tech.category_info;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative animate-rise overflow-hidden rounded-3xl border border-border bg-surface p-7 shadow-soft">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-[0.12] blur-3xl" style={{ background: tech.legacy ? "var(--legacy)" : tech.color }} />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-start">
          <TechIcon icon={tech.icon} color={tech.color} muted={tech.legacy} size={76} className="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {cat && <Badge color={cat.color}>{cat.name}</Badge>}
              <LegacyBadge legacy={tech.legacy} />
              {tech.layer && <Badge>{LAYER_NAMES[tech.layer] ?? humanize(tech.layer)} layer</Badge>}
            </div>
            <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.025em]">{tech.name}</h1>
            <div className="mt-0.5 text-[14px] text-muted">{tech.vendor}</div>
            <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-muted">{tech.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
              {tech.operational_model && <span className="inline-flex items-center gap-1.5"><Server size={14} className="text-faint" />{humanize(tech.operational_model)}</span>}
              {tech.clouds.length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-1.5"><Cloud size={14} className="text-faint" />
                  {tech.clouds.map((c) => <Badge key={c} color="var(--info)">{CLOUD_NAMES[c] ?? c}</Badge>)}
                </span>
              )}
              {tech.aliases.length > 0 && <span className="text-faint">Also known as {tech.aliases.slice(0, 4).join(", ")}</span>}
            </div>
          </div>
          <LinkButton href="/projects/new" variant="primary" icon={Plus} className="shrink-0">Use in a new migration</LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {tech.capabilities.length > 0 && (
            <DetailSection title="Capabilities">
              <div className="flex flex-wrap gap-1.5">{tech.capabilities.map((c) => <span key={c} className="rounded-lg bg-accent-soft px-2 py-1 text-[12px] font-medium text-accent">{c}</span>)}</div>
            </DetailSection>
          )}
          {tech.typical_legacy_use && (
            <DetailSection title="Typical legacy use"><p className="text-[13px] leading-relaxed text-muted">{tech.typical_legacy_use}</p></DetailSection>
          )}
          {tech.migration_considerations.length > 0 && (
            <DetailSection title="Migration considerations"><BulletList items={tech.migration_considerations} /></DetailSection>
          )}
          {tech.known_challenges.length > 0 && (
            <DetailSection title="Known challenges"><BulletList items={tech.known_challenges} color="var(--warn)" /></DetailSection>
          )}
          {tech.strategies_detail.length > 0 && (
            <DetailSection title="Supported migration strategies" hint="7R">
              <div className="space-y-2">{tech.strategies_detail.map((s) => <StrategyCard key={s.id} s={s} />)}</div>
            </DetailSection>
          )}
          {tech.risks_detail.length > 0 && (
            <DetailSection title="Risks" hint={`${tech.risks_detail.length}`}>
              <div className="space-y-2">{tech.risks_detail.map((r) => <RiskItem key={r.id} risk={r} />)}</div>
            </DetailSection>
          )}
        </div>

        <div className="space-y-5">
          {tech.possible_targets_detail.length > 0 && (
            <DetailSection title="Common migration destinations">
              <div className="grid gap-2 sm:grid-cols-2">{tech.possible_targets_detail.map((t) => <TechLink key={t.id} tech={t} />)}</div>
            </DetailSection>
          )}
          {modern.length > 0 && (
            <DetailSection title="Modern alternatives">
              <div className="grid gap-2 sm:grid-cols-2">
                {modern.map((t) => <TechLink key={t.id} tech={t} sub={tech.replaced_by.some((r) => r.id === t.id) ? `Replaces ${tech.name}` : t.vendor} />)}
              </div>
            </DetailSection>
          )}
          {tech.replaces_detail.length > 0 && (
            <DetailSection title={`${tech.name} replaces`}>
              <div className="grid gap-2 sm:grid-cols-2">{tech.replaces_detail.map((t) => <TechLink key={t.id} tech={t} />)}</div>
            </DetailSection>
          )}
          {tech.suggested_next_detail.length > 0 && (
            <DetailSection title="Smart next components" hint="Commonly connected next">
              <div className="grid gap-2 sm:grid-cols-2">{tech.suggested_next_detail.map((t) => <TechLink key={t.id} tech={t} />)}</div>
            </DetailSection>
          )}
          {tech.patterns.length > 0 && (
            <DetailSection title="Architecture patterns">
              <div className="space-y-1.5">
                {tech.patterns.map((p) => (
                  <Link key={p.id} href={`/patterns#${p.id}`} className="group flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
                    <LayoutTemplate size={15} className="mt-0.5 shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium group-hover:text-accent">{p.name}</div>
                      <div className="text-[12px] leading-relaxed text-muted">{p.summary}</div>
                    </div>
                    <ArrowRight size={14} className="mt-1 text-faint" />
                  </Link>
                ))}
              </div>
            </DetailSection>
          )}
          {tech.related.length > 0 && (
            <DetailSection title="Related components">
              <div className="grid gap-2 sm:grid-cols-2">{tech.related.map((t) => <TechLink key={t.id} tech={t} />)}</div>
            </DetailSection>
          )}
        </div>
      </div>

      {tech.mappings.length > 0 && (
        <DetailSection title="Migration mappings" hint={`${tech.mappings.length} curated`}>
          <div className="grid gap-3 xl:grid-cols-2">{tech.mappings.map((m) => <MappingDetail key={m.id} m={m} lookup={lookup} />)}</div>
        </DetailSection>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DetailSection title="Documentation sources">
          {tech.docs.length === 0 && tech.knowledge.length === 0 ? (
            <p className="text-[12.5px] text-muted">No documentation linked yet. Ingest an official source or upload a document on the <Link href="/knowledge" className="text-accent hover:underline">Knowledge</Link> page.</p>
          ) : (
            <div className="space-y-4">
              {tech.docs.length > 0 && <div><SectionLabel className="mb-1">Official documentation</SectionLabel><DocLinks docs={tech.docs} /></div>}
              {tech.knowledge.length > 0 && (
                <div><SectionLabel className="mb-2">From the local knowledge base</SectionLabel>
                  <div className="space-y-2">{tech.knowledge.map((h) => <KnowledgeHit key={h.chunk_id} hit={h} />)}</div>
                </div>
              )}
            </div>
          )}
        </DetailSection>
        {tech.graph.length > 0 && (
          <DetailSection title="Knowledge graph neighbourhood" hint={`${tech.graph.length} links`}>
            <GraphNeighbourhood graph={tech.graph} />
          </DetailSection>
        )}
      </div>
    </div>
  );
}
