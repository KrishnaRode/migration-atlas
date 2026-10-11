"use client";
import { Command } from "cmdk";
import { useReactFlow } from "@xyflow/react";
import { useRouter } from "next/navigation";
import { LayoutGrid, MessageSquare, Plus, Search, ShieldCheck, Sparkles, GitBranch, Map, Columns2, Download, Rows3 } from "lucide-react";
import { TechIcon } from "@/components/ui";
import { NODE_W } from "@/lib/layout";
import { useStudio } from "@/lib/studio-store";

export interface PaletteActions {
  generate: () => void;
  exportAs: (f: "png" | "svg" | "pdf" | "md" | "json") => void;
}

export function CommandPalette({ actions }: { actions: PaletteActions }) {
  const open = useStudio((s) => s.paletteOpen);
  const techIndex = useStudio((s) => s.techIndex);
  const rf = useReactFlow();
  const router = useRouter();
  if (!open) return null;
  const st = useStudio.getState();
  const close = () => st.set({ paletteOpen: false });
  const run = (fn: () => void) => () => { close(); fn(); };
  const addAtCenter = (id: string) => {
    const el = document.querySelector(".react-flow");
    const r = el?.getBoundingClientRect();
    const p = rf.screenToFlowPosition({ x: (r?.left || 0) + (r?.width || 800) / 2, y: (r?.top || 0) + (r?.height || 600) / 2 });
    st.setView("canvas");
    st.addTech(id, { x: p.x - NODE_W / 2, y: p.y - 38 });
  };
  const item = "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] data-[selected=true]:bg-surface-2";
  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center bg-black/30 pt-[14vh] backdrop-blur-[2px] animate-fade" onMouseDown={close}>
      <Command className="w-[600px] animate-pop overflow-hidden rounded-2xl border border-border bg-surface shadow-lift" onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()} loop>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search size={16} className="text-faint" />
          <Command.Input autoFocus placeholder="Type a command or search technologies…" className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
        </div>
        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-[13px] text-faint">No results.</Command.Empty>
          <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-faint">
            <Command.Item className={item} onSelect={run(actions.generate)}><Sparkles size={15} className="text-accent" /> Generate architecture</Command.Item>
            <Command.Item className={item} onSelect={run(() => { st.validate(); st.setRightTab("validation"); })}><ShieldCheck size={15} /> Validate architecture</Command.Item>
            <Command.Item className={item} onSelect={run(() => st.relayout())}><LayoutGrid size={15} /> Auto-layout</Command.Item>
            <Command.Item className={item} onSelect={run(() => st.toggle("swimlanes"))}><Rows3 size={15} /> Toggle swimlanes</Command.Item>
            <Command.Item className={item} onSelect={run(() => st.setRightTab("ai"))}><MessageSquare size={15} /> Ask AI</Command.Item>
            <Command.Item className={item} onSelect={run(() => st.set({ whatIfOpen: true }))}><GitBranch size={15} /> What if…?</Command.Item>
            <Command.Item className={item} onSelect={run(() => st.setView("compare"))}><Columns2 size={15} /> Compare architectures</Command.Item>
            <Command.Item className={item} onSelect={run(() => st.setView("roadmap"))}><Map size={15} /> Generate roadmap</Command.Item>
            <Command.Item className={item} onSelect={run(() => actions.exportAs("pdf"))}><Download size={15} /> Export PDF report</Command.Item>
            <Command.Item className={item} onSelect={run(() => actions.exportAs("png"))}><Download size={15} /> Export PNG diagram</Command.Item>
            <Command.Item className={item} onSelect={run(() => router.push("/technologies"))}><Search size={15} /> Search technologies</Command.Item>
          </Command.Group>
          <Command.Group heading="Add component" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-faint">
            {Object.values(techIndex).map((t) => (
              <Command.Item key={t.id} value={`add ${t.name} ${t.vendor} ${t.category}`} className={item} onSelect={run(() => addAtCenter(t.id))}>
                <TechIcon icon={t.icon} color={t.color} size={22} muted={t.legacy} />
                <span className="flex-1">{t.name}</span>
                <span className="text-[11px] text-faint">{t.vendor}</span>
                <Plus size={13} className="text-faint" />
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
