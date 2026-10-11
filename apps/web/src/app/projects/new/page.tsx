"use client";
import { ArrowLeft, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/shell";
import { ErrorNote } from "@/components/ui";
import { techName } from "@/components/projects/TechChips";
import { ActionBar } from "@/components/projects/intake/ActionBar";
import { DescribePanel } from "@/components/projects/intake/DescribePanel";
import { CloudPicker, CurrentPicker, PlatformPicker, StepTitle } from "@/components/projects/intake/Pickers";
import { EstateDetails, RequirementsPicker } from "@/components/projects/intake/Requirements";
import {
  applyParse, emptyContribution, emptyEstate, platformAvailable, suggestName, summaryLine, type Contribution,
} from "@/components/projects/intake/estate";
import { api, type ParseResult } from "@/lib/api";
import { useOntology } from "@/lib/ontology";
import type { ConstraintDef, Estate } from "@/lib/types";

export default function NewProjectPage() {
  const router = useRouter();
  const { techs, categories, byId, loaded, error: ontologyError } = useOntology();
  const [estate, setEstate] = useState<Estate>(emptyEstate);
  const [text, setText] = useState("");
  const [sources, setSources] = useState<Record<string, "rules" | "ai">>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [defs, setDefs] = useState<ConstraintDef[] | null>(null);
  const [defsError, setDefsError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [useAi, setUseAi] = useState(true);
  const [busy, setBusy] = useState<"generate" | "blank" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contrib = useRef<Contribution>(emptyContribution());
  const dismissed = useRef<Set<string>>(new Set());
  const rulesSeq = useRef(0);
  const aiEpoch = useRef(0);

  useEffect(() => {
    api.constraints().then(setDefs).catch((e) => setDefsError(e instanceof Error ? e.message : "unavailable"));
  }, []);

  const merge = (res: ParseResult, fromAi: boolean) => {
    setEstate((prev) => {
      const out = applyParse(prev, contrib.current, res, dismissed.current);
      contrib.current = out.contrib;
      if (fromAi) {
        // AI finds become sticky: a later rules-only parse must not retract them.
        const ai = new Set(res.detected.filter((d) => d.source === "ai").map((d) => d.tech_id));
        contrib.current = { ...out.contrib, current: out.contrib.current.filter((id) => !ai.has(id)), platforms: out.contrib.platforms.filter((id) => !ai.has(id)) };
      }
      return out.estate;
    });
    setSources((s) => {
      const next = { ...s };
      for (const d of res.detected) if (fromAi || next[d.tech_id] !== "ai") next[d.tech_id] = d.source;
      return next;
    });
  };

  // Instant rules-based extraction while typing.
  useEffect(() => {
    setEstate((e) => ({ ...e, description: text }));
    if (!text.trim()) return;
    const seq = ++rulesSeq.current;
    const epoch = aiEpoch.current;
    const t = setTimeout(() => {
      api.parseEstate(text, false)
        .then((res) => { if (seq === rulesSeq.current && epoch === aiEpoch.current) merge(res, false); })
        .catch(() => { /* live extraction is best-effort; the AI button surfaces errors */ });
    }, 600);
    return () => clearTimeout(t);
  }, [text]);

  const extractAi = async () => {
    setAiBusy(true);
    setError(null);
    try {
      const res = await api.parseEstate(text, true);
      aiEpoch.current++;
      merge(res, true);
      setAiNote(res.ai_note || (res.ai_used ? null : "Local AI wasn't available — extracted with rules only."));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
    } finally {
      setAiBusy(false);
    }
  };

  const release = (id: string) => {
    contrib.current = {
      ...contrib.current,
      current: contrib.current.current.filter((x) => x !== id),
      platforms: contrib.current.platforms.filter((x) => x !== id),
      cloud: contrib.current.cloud === id ? null : contrib.current.cloud,
    };
  };

  const toggleCurrent = (id: string) => {
    release(id);
    setEstate((e) => {
      const on = e.current_technologies.includes(id);
      if (on) dismissed.current.add(id); else dismissed.current.delete(id);
      return { ...e, current_technologies: on ? e.current_technologies.filter((x) => x !== id) : [...e.current_technologies, id] };
    });
  };
  const setCloud = (id: string | null) => {
    if (estate.target_cloud) { release(estate.target_cloud); if (!id) dismissed.current.add(estate.target_cloud); }
    if (id) dismissed.current.delete(id);
    setEstate((e) => ({ ...e, target_cloud: id, target_platforms: e.target_platforms.filter((p) => platformAvailable(p, id)) }));
  };
  const togglePlatform = (id: string) => {
    release(id);
    setEstate((e) => {
      const on = e.target_platforms.includes(id);
      if (on) dismissed.current.add(id); else dismissed.current.delete(id);
      return { ...e, target_platforms: on ? e.target_platforms.filter((x) => x !== id) : [...e.target_platforms, id] };
    });
  };
  const removeTech = (id: string) => {
    if (estate.target_cloud === id) setCloud(null);
    else if (estate.target_platforms.includes(id)) togglePlatform(id);
    else toggleCurrent(id);
  };

  const nameOf = (id: string) => techName(id, byId(id));
  const suggestion = suggestName(estate, nameOf);
  const summary = summaryLine(estate, nameOf);
  const canGenerate = estate.current_technologies.length > 0 || !!estate.target_cloud || estate.target_platforms.length > 0;

  const create = async (kind: "generate" | "blank") => {
    setBusy(kind);
    setError(null);
    try {
      const blank = kind === "blank";
      const finalEstate: Estate = blank ? emptyEstate() : { ...estate, description: text.trim(), notes: estate.notes ?? [], retain_technologies: estate.retain_technologies ?? [], exclude_technologies: estate.exclude_technologies ?? [] };
      const project = await api.createProject({
        name: blank ? (name.trim() || "Untitled architecture") : (name.trim() || suggestion),
        description: blank ? "" : text.trim() || summary,
        industry: blank ? null : estate.industry ?? null,
        estate: finalEstate,
      });
      router.push(blank ? `/studio/${project.id}` : `/studio/${project.id}?generate=1${useAi ? "" : "&ai=0"}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the project.");
      setBusy(null);
    }
  };

  return (
    <PageShell>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="animate-rise">
          <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-[12px] font-medium text-faint hover:text-text"><ArrowLeft size={13} /> Projects</Link>
          <h1 className="font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">New migration</h1>
          <p className="mt-1 text-[13.5px] text-muted">Tell us where you are and where you&apos;re heading. Write it, pick it — or both.</p>
        </div>
        <button onClick={() => create("blank")} disabled={!!busy}
          className="inline-flex animate-rise items-center gap-1.5 self-start rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50 sm:self-auto"
          style={{ animationDelay: "60ms" }}>
          <PenLine size={13} /> {busy === "blank" ? "Creating…" : "Start from a blank canvas"}
        </button>
      </div>

      {error && <div className="mt-5 animate-fade"><ErrorNote message={error} /></div>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <div className="animate-rise lg:sticky lg:top-20 lg:self-start" style={{ animationDelay: "80ms" }}>
          <DescribePanel text={text} onText={setText} onExtract={extractAi} aiBusy={aiBusy} aiNote={aiNote}
            estate={estate} sources={sources} byId={byId} onRemoveTech={removeTech} />
        </div>

        <div className="animate-rise space-y-9" style={{ animationDelay: "140ms" }}>
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            Or pick visually <span className="h-px flex-1 bg-border" />
          </div>
          <section>
            <StepTitle n="01" title="Current estate" hint={estate.current_technologies.length ? `${estate.current_technologies.length} selected` : undefined} />
            <CurrentPicker techs={techs} categories={categories} selected={estate.current_technologies} onToggle={toggleCurrent} loaded={loaded} error={ontologyError} />
          </section>
          <section>
            <StepTitle n="02" title="Target cloud" />
            <CloudPicker byId={byId} value={estate.target_cloud} onChange={setCloud} />
          </section>
          <section>
            <StepTitle n="03" title="Target data platform" hint="Optional" />
            <PlatformPicker byId={byId} cloud={estate.target_cloud} selected={estate.target_platforms} onToggle={togglePlatform} />
          </section>
          <section>
            <StepTitle n="04" title="Requirements" />
            <RequirementsPicker defs={defs} error={defsError} value={estate.constraints}
              onChange={(constraints) => {
                const removed = estate.constraints.filter((c) => !constraints.some((x) => x.id === c.id)).map((c) => c.id);
                removed.forEach((id) => dismissed.current.add(`c:${id}`));
                constraints.forEach((c) => dismissed.current.delete(`c:${c.id}`));
                contrib.current = { ...contrib.current, constraints: contrib.current.constraints.filter((id) => !constraints.some((c) => c.id === id) && !removed.includes(id)) };
                setEstate((e) => ({ ...e, constraints }));
              }} />
          </section>
          <section>
            <StepTitle n="05" title="Details" />
            <EstateDetails volume={estate.data_volume_tb} industry={estate.industry}
              onVolume={(v) => { contrib.current = { ...contrib.current, volume: null }; setEstate((e) => ({ ...e, data_volume_tb: v })); }}
              onIndustry={(v) => { contrib.current = { ...contrib.current, industry: null }; setEstate((e) => ({ ...e, industry: v })); }} />
          </section>
        </div>
      </div>

      <ActionBar name={name} suggestion={suggestion} onName={setName} summary={summary} useAi={useAi} onUseAi={setUseAi}
        canGenerate={canGenerate && !busy} busy={busy === "generate"} onGenerate={() => create("generate")} />
    </PageShell>
  );
}
