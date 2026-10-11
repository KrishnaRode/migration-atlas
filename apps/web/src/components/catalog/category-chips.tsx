"use client";
import { LayoutGrid } from "lucide-react";
import { iconFor } from "@/components/ui";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CategoryChips({ categories, value, onChange, total }: {
  categories: Category[]; value: string | null; onChange: (id: string | null) => void; total: number;
}) {
  const base = "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-all";
  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => onChange(null)}
        className={cn(base, value === null ? "border-text bg-text text-bg" : "border-border bg-surface text-muted hover:border-border-strong hover:text-text")}>
        <LayoutGrid size={13} /> All <span className="opacity-60">{total}</span>
      </button>
      {categories.filter((c) => (c.count ?? 0) > 0).map((c) => {
        const Icon = iconFor(c.icon);
        const active = value === c.id;
        return (
          <button key={c.id} onClick={() => onChange(active ? null : c.id)}
            className={cn(base, active ? "text-text" : "border-border bg-surface text-muted hover:border-border-strong hover:text-text")}
            style={active ? { borderColor: c.color, background: `color-mix(in srgb, ${c.color} 12%, transparent)` } : undefined}>
            <Icon size={13} style={{ color: c.color }} />
            {c.name}
            <span className="opacity-60">{c.count}</span>
          </button>
        );
      })}
    </div>
  );
}
