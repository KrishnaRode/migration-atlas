"use client";
import { FolderOpen, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/shell";
import { EmptyState, ErrorNote, LinkButton, SectionLabel } from "@/components/ui";
import { SampleCard, useSamples } from "@/components/landing/SampleEstates";
import { useOpenSample } from "@/components/landing/useOpenSample";
import { ImportButton } from "@/components/projects/ImportButton";
import { ProjectCard, ProjectCardSkeleton } from "@/components/projects/ProjectCard";
import { api } from "@/lib/api";
import { useOntology } from "@/lib/ontology";
import type { ProjectSummary } from "@/lib/types";

export default function ProjectsPage() {
  const { byId } = useOntology();
  const { samples } = useSamples();
  const sample = useOpenSample();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setProjects(null);
    api.projects()
      .then((p) => setProjects([...p].sort((a, b) => b.updated_at.localeCompare(a.updated_at))))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load projects."));
  }, []);
  useEffect(load, [load]);

  const remove = async (id: string) => {
    setActionError(null);
    try {
      await api.deleteProject(id);
      setProjects((ps) => ps?.filter((p) => p.id !== id) ?? null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete the project.");
    }
  };

  const banner = actionError || sample.error;

  return (
    <PageShell>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="animate-rise">
          <h1 className="font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">Projects</h1>
          <p className="mt-1 text-[13.5px] text-muted">Every migration you are exploring — estates, target options and roadmaps, stored locally.</p>
        </div>
        <div className="flex animate-rise items-center gap-2" style={{ animationDelay: "60ms" }}>
          <ImportButton onError={setActionError} />
          <LinkButton href="/projects/new" variant="primary" icon={Plus}>New migration</LinkButton>
        </div>
      </div>

      {banner && <div className="mt-5 animate-fade"><ErrorNote message={banner} /></div>}

      {samples && samples.length > 0 && (
        <section className="mt-9 animate-rise" style={{ animationDelay: "100ms" }}>
          <div className="mb-3 flex items-baseline justify-between">
            <SectionLabel>Start from a sample</SectionLabel>
            <span className="text-[11.5px] text-faint">Opens the studio and generates a target architecture</span>
          </div>
          <div className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-2">
            {samples.map((s, i) => (
              <div key={s.id} className="w-[290px] shrink-0 snap-start">
                <SampleCard s={s} i={i} compact pending={sample.pending === s.id} onOpen={() => sample.open(s.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <SectionLabel>Your projects{projects ? ` · ${projects.length}` : ""}</SectionLabel>
        </div>
        {error ? (
          <ErrorNote message={error} onRetry={load} />
        ) : !projects ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((k) => <ProjectCardSkeleton key={k} />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50">
            <EmptyState icon={FolderOpen} title="No projects yet"
              body="Describe your legacy estate, start from a sample above, or import a Migration Atlas JSON export."
              action={<LinkButton href="/projects/new" variant="primary" icon={Plus}>New migration</LinkButton>} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => <ProjectCard key={p.id} p={p} i={i} byId={byId} onDelete={remove} />)}
          </div>
        )}
      </section>
    </PageShell>
  );
}
