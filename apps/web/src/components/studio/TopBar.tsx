"use client";
import {
  ChevronDown, Columns2, Download, GitBranch, LayoutGrid, Map, Maximize2, PanelLeft, PanelRight, Plus, Redo2, Rows3,
  ShieldCheck, Sparkles, Undo2, Users, Code2, Building2, Workflow, Command as CommandIcon, Check, Loader2, Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo, LocalAIBadge, ThemeToggle } from "@/components/shell";
import { Button, Kbd } from "@/components/ui";
import { useStudio, type View } from "@/lib/studio-store";
import { cn, SEVERITY_COLOR } from "@/lib/utils";

const VIEWS: { id: View; label: string; icon: typeof Workflow }[] = [
  { id: "canvas", label: "Canvas", icon: Workflow },
  { id: "leader", label: "Leader", icon: Users },
  { id: "developer", label: "Developer", icon: Code2 },
  { id: "architect", label: "Architect", icon: Building2 },
  { id: "roadmap", label: "Roadmap", icon: Map },
  { id: "compare", label: "Compare", icon: Columns2 },
];

export function TopBar({ onGenerate, generating, onExport }: { onGenerate: () => void; generating: boolean; onExport: (f: "png" | "svg" | "pdf" | "md" | "json") => void }) {
  const project = useStudio((s) => s.project);
  const activeId = useStudio((s) => s.activeId);
  const view = useStudio((s) => s.view);
  const saving = useStudio((s) => s.saving);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const swimlanes = useStudio((s) => s.swimlanes);
  const counts = useStudio((s) => s.validation?.counts);
  const st = useStudio.getState();
  if (!project) return null;
  const high = (counts?.critical || 0) + (counts?.high || 0);
  return (
    <div className="border-b border-border bg-surface">
      <div className="flex h-12 items-center gap-3 px-3">
        <Link href="/projects" className="flex items-center gap-2" title="All projects"><Logo size={24} /></Link>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold leading-tight">{project.name}</div>
          <div className="flex items-center gap-1 text-[10.5px] text-faint">
            {saving ? <><Loader2 size={9} className="animate-spin" /> Saving…</> : <><Check size={9} /> Saved locally</>}
          </div>
        </div>
        <div className="mx-2 h-6 w-px bg-border" />
        <div className="flex items-center gap-0.5 rounded-[10px] bg-surface-2 p-0.5">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => st.setView(v.id)}
              className={cn("inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition-all",
                view === v.id ? "bg-surface text-text shadow-soft" : "text-muted hover:text-text")}>
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => st.set({ paletteOpen: true })} className="hidden h-8 items-center gap-2 rounded-lg border border-border px-2.5 text-[12px] text-faint hover:text-text lg:flex">
            <CommandIcon size={12} /> Commands <Kbd>⌘K</Kbd>
          </button>
          <LocalAIBadge compact />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex h-11 items-center gap-1.5 border-t border-border px-3">
        <button onClick={() => st.toggle("libraryOpen")} title="Toggle component library" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text"><PanelLeft size={15} /></button>
        <OptionTabs />
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="primary" icon={Sparkles} loading={generating} onClick={onGenerate}>Generate</Button>
          <Button size="sm" icon={ShieldCheck} onClick={() => { st.validate(); st.setRightTab("validation"); }}>
            Validate
            {counts && <span className="ml-0.5 rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: high ? SEVERITY_COLOR.high : "var(--ok)" }}>{high || "✓"}</span>}
          </Button>
          <Button size="sm" icon={GitBranch} onClick={() => st.set({ whatIfOpen: true })}>What if?</Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <IconBtn title="Undo (⌘Z)" disabled={!canUndo} onClick={st.undo}><Undo2 size={15} /></IconBtn>
          <IconBtn title="Redo (⇧⌘Z)" disabled={!canRedo} onClick={st.redo}><Redo2 size={15} /></IconBtn>
          <IconBtn title="Auto-layout (L)" onClick={() => { st.setView("canvas"); st.relayout(); }}><LayoutGrid size={15} /></IconBtn>
          <IconBtn title="Swimlanes" active={swimlanes} onClick={() => st.toggle("swimlanes")}><Rows3 size={15} /></IconBtn>
          <IconBtn title="Full screen" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}><Maximize2 size={15} /></IconBtn>
          <ExportMenu onExport={onExport} />
          <IconBtn title="Toggle right panel" onClick={() => st.toggle("rightOpen")}><PanelRight size={15} /></IconBtn>
        </div>
      </div>
      <span className="hidden">{activeId}</span>
    </div>
  );
}

function IconBtn({ children, onClick, title, disabled, active }: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={cn("rounded-lg p-1.5 transition-colors disabled:opacity-30", active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text")}>
      {children}
    </button>
  );
}

function OptionTabs() {
  const options = useStudio((s) => s.project?.options) || [];
  const activeId = useStudio((s) => s.activeId);
  const [editing, setEditing] = useState<string | null>(null);
  const st = useStudio.getState();
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {options.map((o) => (
        <div key={o.id} className={cn("group flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
          o.id === activeId ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-text")}>
          {o.meta.what_if ? <GitBranch size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
          {editing === o.id ? (
            <input autoFocus defaultValue={o.name} className="w-40 bg-transparent outline-none"
              onBlur={(e) => { st.renameOption(o.id, e.target.value || o.name); setEditing(null); }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
          ) : (
            <button onClick={() => o.id !== activeId && st.switchOption(o.id)} onDoubleClick={() => setEditing(o.id)} title="Double-click to rename" className="max-w-[220px] truncate">{o.name}</button>
          )}
          {options.length > 1 && o.id === activeId && (
            <button onClick={() => confirm(`Delete option "${o.name}"?`) && st.deleteOption(o.id)} className="opacity-0 transition-opacity group-hover:opacity-100" title="Delete option"><Trash2 size={11} /></button>
          )}
        </div>
      ))}
      <button onClick={() => st.set({ whatIfOpen: true })} title="New option via what-if" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-text"><Plus size={14} /></button>
    </div>
  );
}

function ExportMenu({ onExport }: { onExport: (f: "png" | "svg" | "pdf" | "md" | "json") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);
  const items: { f: "png" | "svg" | "pdf" | "md" | "json"; label: string; hint: string }[] = [
    { f: "pdf", label: "PDF report", hint: "Full migration report" },
    { f: "png", label: "PNG diagram", hint: "High-resolution image" },
    { f: "svg", label: "SVG diagram", hint: "Vector image" },
    { f: "md", label: "Markdown report", hint: "For docs & wikis" },
    { f: "json", label: "Project JSON", hint: "Re-importable" },
  ];
  return (
    <div ref={ref} className="relative">
      <Button size="sm" icon={Download} onClick={() => setOpen(!open)}>Export <ChevronDown size={12} /></Button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-56 animate-pop rounded-xl border border-border bg-surface p-1 shadow-lift">
          {items.map((i) => (
            <button key={i.f} onClick={() => { setOpen(false); onExport(i.f); }} className="flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-2">
              <span className="text-[12.5px] font-medium">{i.label}</span><span className="text-[11px] text-faint">{i.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
