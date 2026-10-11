"use client";
import { ArrowRight, BookOpen, Boxes, GitFork, LayoutTemplate, SearchX, ShieldAlert, Shuffle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, SectionLabel } from "@/components/ui";
import type { api } from "@/lib/api";
import type { Category, TechCard } from "@/lib/types";
import { KnowledgeHit, MappingCard, RiskItem, TechTile, humanize, stagger } from "./primitives";

export type SearchResult = Awaited<ReturnType<typeof api.search>>;

function Section({ title, icon: Icon, count, children }: { title: string; icon: typeof Boxes; count: number; children: ReactNode }) {
  return (
    <section className="animate-rise">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={15} className="text-accent" />
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
        <span className="rounded-md bg-surface-2 px-1.5 text-[11px] font-medium text-faint">{count}</span>
      </div>
      {children}
    </section>
  );
}

export function SearchResults({ result, categories, byId }: {
  result: SearchResult; categories: Category[]; byId: (id: string) => TechCard | undefined;
}) {
  const cat = (id: string) => categories.find((c) => c.id === id);
  // Prefer the richer cards from the search payload, falling back to the cached ontology.
  const lookup = (id: string) => result.technologies.find((t) => t.id === id) || result.related.find((t) => t.id === id) || byId(id);
  const empty = !result.technologies.length && !result.mappings.length && !result.patterns.length
    && !result.knowledge.length && !result.risks.length && !result.related.length;

  if (empty) {
    return <EmptyState icon={SearchX} title={`Nothing found for “${result.query}”`} body="Try a product name such as Informatica, Teradata or Kafka, or a phrase like 'Oracle to Databricks'." />;
  }

  return (
    <div className="space-y-10">
      {result.graph_path.length > 0 && (
        <div className="flex animate-rise flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-surface px-4 py-3 shadow-soft">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint"><GitFork size={13} /> Knowledge graph path</span>
          {result.graph_path.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              {i === 0 && <span className="rounded-lg bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent">{s.from_label}</span>}
              <span className="inline-flex items-center gap-0.5 font-mono text-[10.5px] text-faint">—{s.relation}<ArrowRight size={11} /></span>
              <span className="rounded-lg bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent">{s.to_label}</span>
            </span>
          ))}
        </div>
      )}

      {result.technologies.length > 0 && (
        <Section title="Technologies" icon={Boxes} count={result.technologies.length}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.technologies.map((t, i) => <TechTile key={t.id} tech={t} category={cat(t.category)} index={i} />)}
          </div>
        </Section>
      )}

      {result.mappings.length > 0 && (
        <Section title="Migration mappings" icon={Shuffle} count={result.mappings.length}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {result.mappings.map((m, i) => <MappingCard key={m.id} mapping={m} byId={lookup} index={i} />)}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {result.patterns.length > 0 && (
          <Section title="Architecture patterns" icon={LayoutTemplate} count={result.patterns.length}>
            <div className="space-y-2">
              {result.patterns.map((p, i) => (
                <Link key={p.id} href={`/patterns#${p.id}`} style={stagger(i, 50)}
                  className="group block animate-rise rounded-xl border border-border bg-surface p-3.5 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-soft">
                  <div className="flex items-center justify-between gap-2 text-[13px] font-semibold group-hover:text-accent">{p.name}<ArrowRight size={14} className="text-faint" /></div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{p.summary}</p>
                </Link>
              ))}
            </div>
          </Section>
        )}
        {result.knowledge.length > 0 && (
          <Section title="Knowledge" icon={BookOpen} count={result.knowledge.length}>
            <div className="space-y-2">{result.knowledge.map((h) => <KnowledgeHit key={h.chunk_id} hit={h} />)}</div>
          </Section>
        )}
        {result.risks.length > 0 && (
          <Section title="Related risks" icon={ShieldAlert} count={result.risks.length}>
            <div className="space-y-2">{result.risks.map((r) => <RiskItem key={r.id} risk={r} />)}</div>
          </Section>
        )}
        {result.related.length > 0 && (
          <Section title="Related components" icon={GitFork} count={result.related.length}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {result.related.map((t) => (
                <Link key={t.id} href={`/technologies/${t.id}`} className="group flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-[12.5px] font-medium transition-all hover:border-border-strong hover:shadow-soft">
                  <span className="truncate group-hover:text-accent">{t.name}</span>
                  <span className="ml-2 shrink-0 text-[11px] text-faint">{cat(t.category)?.name ?? humanize(t.category)}</span>
                </Link>
              ))}
            </div>
          </Section>
        )}
      </div>
      <SectionLabel className="text-center">Results combine the ontology, curated mappings, the knowledge graph and local documents.</SectionLabel>
    </div>
  );
}
