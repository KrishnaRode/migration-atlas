"use client";
import { ReactFlowProvider } from "@xyflow/react";
import { Bot, Info, ShieldCheck, SlidersHorizontal, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { captureCanvas, dataUrlToBlob } from "@/lib/export";
import { loadCategories, loadTechnologies } from "@/lib/ontology";
import { useStudio, type RightTab } from "@/lib/studio-store";
import type { Category, PipelineStep, TechCard } from "@/lib/types";
import { cn, download, slug } from "@/lib/utils";
import { Canvas } from "./canvas/Canvas";
import { CommandPalette } from "./CommandPalette";
import { AdrDialog, GenerationOverlay, ReplaceDialog, Toasts, WhatIfDialog } from "./Dialogs";
import { CopilotPanel } from "./panels/CopilotPanel";
import { Inspector } from "./panels/Inspector";
import { Library } from "./panels/Library";
import { ValidationPanel } from "./panels/ValidationPanel";
import { TopBar } from "./TopBar";
import { CompareView } from "./views/CompareView";
import { ArchitectView, DeveloperView, LeaderView } from "./views/PersonaViews";
import { RoadmapView } from "./views/RoadmapView";

const VIEWS = ["canvas", "leader", "developer", "architect", "roadmap", "compare"] as const;

export function Studio({ projectId, autoGenerate, useAi, initialView }: { projectId: string; autoGenerate: boolean; useAi: boolean; initialView?: string | null }) {
  return (
    <ReactFlowProvider>
      <StudioInner projectId={projectId} autoGenerate={autoGenerate} useAi={useAi} initialView={initialView} />
    </ReactFlowProvider>
  );
}

function StudioInner({ projectId, autoGenerate, useAi, initialView }: { projectId: string; autoGenerate: boolean; useAi: boolean; initialView?: string | null }) {
  const [techs, setTechs] = useState<TechCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineStep[] | null>(null);
  const project = useStudio((s) => s.project);
  const view = useStudio((s) => s.view);
  const rightOpen = useStudio((s) => s.rightOpen);
  const libraryOpen = useStudio((s) => s.libraryOpen);
  const nodeCount = useStudio((s) => s.nodes.length);
  const started = useRef(false);

  const generate = useCallback(async (ai = useAi) => {
    const st = useStudio.getState();
    if (!st.project) return;
    setGenerating(true);
    setPipeline(null);
    try {
      const res = await api.generate(st.project.estate, ai);
      setPipeline(res.pipeline);
      await new Promise((r) => setTimeout(r, 900));
      const hasContent = st.nodes.length > 0;
      if (hasContent) await st.addOption(res.architecture);
      else await st.loadArchitecture(res.architecture, { layout: true, animate: true, record: false });
      st.setView("canvas");
      st.toast({ title: "Target architecture generated", body: res.architecture.meta.ai_status || undefined, tone: "ok" });
    } catch (e) {
      st.toast({ title: "Generation failed", body: (e as Error).message, tone: "bad" });
    } finally {
      setGenerating(false);
      setTimeout(() => setPipeline(null), 300);
    }
  }, [useAi]);

  useEffect(() => {
    let alive = true;
    Promise.all([api.project(projectId), loadTechnologies(), loadCategories()])
      .then(async ([p, t, c]) => {
        if (!alive) return;
        setTechs(t);
        setCategories(c);
        await useStudio.getState().init(p, t);
        const v = VIEWS.find((x) => x === initialView);
        if (v) useStudio.getState().setView(v);
        if (autoGenerate && !started.current && !p.options.length) {
          started.current = true;
          window.history.replaceState(null, "", `/studio/${projectId}`);
          void generate(useAi);
        }
      })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const exportAs = useCallback(async (f: "png" | "svg" | "pdf" | "md" | "json") => {
    const st = useStudio.getState();
    if (!st.project) return;
    await st.save();
    const p = useStudio.getState().project!;
    const base = slug(p.name);
    try {
      if (f === "json") {
        download(`${base}.migration-atlas.json`, JSON.stringify(p, null, 2), "application/json");
        return;
      }
      if (st.view !== "canvas") { st.setView("canvas"); await new Promise((r) => setTimeout(r, 450)); }
      const capture = async (fmt: "png" | "svg") => captureCanvas(useStudio.getState().nodes, fmt);
      if (f === "png" || f === "svg") {
        download(`${base}-diagram.${f}`, dataUrlToBlob(await capture(f)));
        st.toast({ title: `${f.toUpperCase()} exported`, tone: "ok" });
        return;
      }
      let png: string | undefined;
      try { png = await capture("png"); } catch { png = undefined; }
      if (f === "md") {
        const md = await api.exportMarkdown(p, st.activeId, png);
        download(`${base}-report.md`, md, "text/markdown");
      } else {
        st.toast({ title: "Building PDF report…", tone: "info" });
        const res = await api.exportPdf(p, st.activeId, png);
        download(`${base}-report.pdf`, await res.blob());
      }
      st.toast({ title: `${f === "md" ? "Markdown" : "PDF"} report exported`, tone: "ok" });
    } catch (e) {
      st.toast({ title: "Export failed", body: (e as Error).message, tone: "bad" });
    }
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStudio.getState();
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); st.set({ paletteOpen: !st.paletteOpen }); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); st.redo(); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); st.duplicate(st.nodes.filter((n) => n.selected).map((n) => n.id)); }
      else if (mod && e.key.toLowerCase() === "g") { e.preventDefault(); st.groupSelection(); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); void st.save(); st.toast({ title: "Saved locally", tone: "ok" }); }
      else if (!mod && e.key.toLowerCase() === "l") { void st.relayout(); }
      else if (!mod && e.key.toLowerCase() === "f") { st.set({ fitNonce: st.fitNonce + 1 }); }
      else if (e.key === "Escape") { st.select(null, null); st.set({ suggestionFor: null }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3"><ErrorNote message={error} onRetry={() => location.reload()} />
          <Link href="/projects" className="text-[13px] text-accent hover:underline">← Back to projects</Link></div>
      </div>
    );
  }
  if (!project) {
    return <div className="flex min-h-screen items-center justify-center gap-2 text-[13px] text-muted"><Spinner /> Opening studio…</div>;
  }

  const addAtCenter = (id: string) => {
    const st = useStudio.getState();
    st.setView("canvas");
    const xs = st.nodes.map((n) => n.position.x);
    st.addTech(id, { x: xs.length ? Math.max(...xs) + 280 : 0, y: 0 });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      <TopBar onGenerate={() => generate(useAi)} generating={generating} onExport={exportAs} />
      <div className="flex min-h-0 flex-1">
        {libraryOpen && view === "canvas" && (
          <aside className="w-[268px] shrink-0 border-r border-border bg-surface animate-fade">
            <Library techs={techs} categories={categories} onAdd={addAtCenter} />
          </aside>
        )}
        <main className="relative min-w-0 flex-1 bg-canvas">
          <div className={cn("absolute inset-0", view !== "canvas" && "pointer-events-none opacity-0")} aria-hidden={view !== "canvas"}>
            <Canvas />
            {!nodeCount && !generating && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="pointer-events-auto max-w-md rounded-2xl border border-border bg-surface/90 p-2 shadow-lift backdrop-blur">
                  <EmptyState icon={Workflow} title="Don't start with a blank canvas"
                    body={project.estate.current_technologies.length || project.estate.target_platforms.length
                      ? "Generate a target architecture from your estate, or drag components from the library."
                      : "Drag components from the library, apply a pattern, or describe your estate first."}
                    action={<div className="flex gap-2">
                      <Button variant="primary" icon={Sparkles} onClick={() => generate(useAi)} disabled={!project.estate.current_technologies.length && !project.estate.target_platforms.length && !project.estate.target_cloud}>Generate target architecture</Button>
                      <Link href="/patterns"><Button>Patterns</Button></Link>
                    </div>} />
                </div>
              </div>
            )}
            <GenerationOverlay running={generating} useAi={useAi} done={pipeline} />
          </div>
          {view !== "canvas" && (
            <div className="absolute inset-0 z-20 overflow-y-auto bg-bg animate-fade">
              {view === "leader" && <LeaderView />}
              {view === "developer" && <DeveloperView />}
              {view === "architect" && <ArchitectView />}
              {view === "roadmap" && <RoadmapView />}
              {view === "compare" && <CompareView />}
            </div>
          )}
        </main>
        {rightOpen && <RightPanel />}
      </div>
      <ReplaceDialog />
      <WhatIfDialog />
      <AdrDialog />
      <CommandPalette actions={{ generate: () => generate(useAi), exportAs }} />
      <Toasts />
    </div>
  );
}

function RightPanel() {
  const tab = useStudio((s) => s.rightTab);
  const counts = useStudio((s) => s.validation?.counts);
  const issues = (counts?.critical || 0) + (counts?.high || 0) + (counts?.medium || 0);
  const tabs: { id: RightTab; label: string; icon: typeof Info }[] = [
    { id: "inspector", label: "Inspector", icon: SlidersHorizontal },
    { id: "ai", label: "AI Copilot", icon: Bot },
    { id: "validation", label: "Validation", icon: ShieldCheck },
  ];
  return (
    <aside className="flex w-[372px] shrink-0 flex-col border-l border-border bg-surface animate-fade">
      <div className="flex border-b border-border px-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => useStudio.getState().setRightTab(t.id)}
            className={cn("relative flex h-10 flex-1 items-center justify-center gap-1.5 text-[12.5px] font-medium transition-colors",
              tab === t.id ? "text-text" : "text-faint hover:text-muted")}>
            <t.icon size={13} /> {t.label}
            {t.id === "validation" && issues > 0 && <span className="rounded-full bg-surface-3 px-1.5 text-[10px] text-muted">{issues}</span>}
            {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "inspector" && <Inspector />}
        <div className={cn("h-full", tab !== "ai" && "hidden")}><CopilotPanel /></div>
        {tab === "validation" && <ValidationPanel />}
      </div>
    </aside>
  );
}
