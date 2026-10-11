"use client";
import { ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { iconFor, TechIcon } from "@/components/ui";
import type { Category, TechCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Library({ techs, categories, onAdd }: { techs: TechCard[]; categories: Category[]; onAdd: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [scope, setScope] = useState<"all" | "modern" | "legacy">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return techs.filter((t) => {
      if (cat && t.category !== cat) return false;
      if (scope === "modern" && t.legacy) return false;
      if (scope === "legacy" && !t.legacy) return false;
      if (!needle) return true;
      return `${t.name} ${t.vendor} ${t.category} ${t.tags.join(" ")} ${t.capabilities.join(" ")}`.toLowerCase().includes(needle);
    });
  }, [techs, q, cat, scope]);

  const grouped = useMemo(() => categories.map((c) => ({ c, items: filtered.filter((t) => t.category === c.id) })).filter((g) => g.items.length), [categories, filtered]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2.5 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold">Components</div>
          <div className="text-[11px] text-faint">{filtered.length} of {techs.length}</div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search technologies…"
            className="h-8 w-full rounded-[9px] border border-border bg-surface-2 pl-8 pr-7 text-[12.5px] outline-none transition-colors placeholder:text-faint focus:border-accent focus:bg-surface" />
          {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-text"><X size={13} /></button>}
        </div>
        <div className="flex gap-1">
          {(["all", "modern", "legacy"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)}
              className={cn("h-6 rounded-md px-2 text-[11px] font-medium capitalize transition-colors", scope === s ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2")}>{s}</button>
          ))}
        </div>
        <div className="flex max-h-[76px] flex-wrap gap-1 overflow-y-auto">
          {categories.filter((c) => techs.some((t) => t.category === c.id)).map((c) => {
            const Icon = iconFor(c.icon);
            const on = cat === c.id;
            return (
              <button key={c.id} onClick={() => setCat(on ? null : c.id)} title={c.name}
                className={cn("inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10.5px] font-medium transition-colors",
                  on ? "border-transparent text-white" : "border-border text-muted hover:text-text")}
                style={on ? { background: c.color } : undefined}>
                <Icon size={11} /> {c.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {grouped.map(({ c, items }) => (
          <div key={c.id} className="mb-1.5">
            <button onClick={() => setCollapsed({ ...collapsed, [c.id]: !collapsed[c.id] })}
              className="flex w-full items-center gap-1.5 px-1.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint hover:text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
              {c.name}
              <span className="font-normal normal-case tracking-normal">· {items.length}</span>
              <ChevronDown size={12} className={cn("ml-auto transition-transform", collapsed[c.id] && "-rotate-90")} />
            </button>
            {!collapsed[c.id] && items.map((t) => (
              <div key={t.id} draggable
                onDragStart={(e) => { e.dataTransfer.setData("application/atlas-tech", t.id); e.dataTransfer.effectAllowed = "move"; }}
                onDoubleClick={() => onAdd(t.id)}
                title={`${t.description}\n\nDrag onto the canvas (or double-click).`}
                className="group flex cursor-grab items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 transition-colors hover:bg-surface-2 active:cursor-grabbing">
                <TechIcon icon={t.icon} color={t.color} size={28} muted={t.legacy} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium">{t.name}</span>
                    {t.legacy && <span className="rounded bg-surface-3 px-1 text-[9px] font-semibold uppercase tracking-wide text-faint">legacy</span>}
                  </div>
                  <div className="truncate text-[10.5px] text-faint">{t.vendor} · {t.capabilities.slice(0, 2).join(", ")}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {!grouped.length && <div className="px-3 py-8 text-center text-[12px] text-faint">No components match.</div>}
      </div>
    </div>
  );
}
