"use client";
import { Check } from "lucide-react";
import { TechIcon } from "@/components/ui";
import type { Category, TechCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CLOUDS, CURRENT_CATEGORIES, CURRENT_EXTRAS, PLATFORMS, platformAvailable } from "./estate";

export function StepTitle({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2.5">
      <span className="font-mono text-[10.5px] text-faint">{n}</span>
      <h3 className="text-[14px] font-semibold tracking-[-0.015em]">{title}</h3>
      {hint && <span className="ml-auto text-[11.5px] text-faint">{hint}</span>}
    </div>
  );
}

export function CurrentPicker({ techs, categories, selected, onToggle, loaded, error }: {
  techs: TechCard[]; categories: Category[]; selected: string[]; onToggle: (id: string) => void; loaded: boolean; error: string | null;
}) {
  if (error) return <div className="rounded-xl border border-dashed border-border-strong px-4 py-3 text-[12.5px] text-muted">The technology library loads from the local backend. Start it with <code className="font-mono text-text">./start.sh</code>, or just describe your estate.</div>;
  if (!loaded) return <div className="space-y-3">{[0, 1, 2].map((k) => <div key={k} className="shimmer h-16 rounded-xl" />)}</div>;
  const groups = CURRENT_CATEGORIES.map((cid) => ({
    cat: categories.find((c) => c.id === cid),
    id: cid,
    items: techs.filter((t) => t.category === cid && (t.legacy || CURRENT_EXTRAS.includes(t.id))),
  })).filter((g) => g.items.length);
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.id}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.cat?.color || "var(--faint)" }} />
            {g.cat?.name || g.id}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((t) => {
              const on = selected.includes(t.id);
              return (
                <button key={t.id} onClick={() => onToggle(t.id)} aria-pressed={on} title={t.vendor}
                  className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border pl-0.5 pr-2.5 text-[12px] font-medium transition-all duration-150 active:scale-[0.97]",
                    on ? "border-accent/50 bg-accent-soft text-text shadow-soft" : "border-border bg-surface text-muted hover:border-border-strong hover:text-text")}>
                  <TechIcon icon={t.icon} color={t.color} size={22} className="rounded-full" />
                  {t.name}
                  {on && <Check size={12} className="animate-pop text-accent" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function BigCard({ selected, disabled, onClick, children, title }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={selected} title={title}
      className={cn("relative flex items-center gap-3 rounded-2xl border bg-surface p-3.5 text-left transition-all duration-150 active:scale-[0.98]",
        selected ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-border hover:-translate-y-0.5 hover:border-border-strong hover:shadow-soft",
        disabled && "cursor-not-allowed opacity-40 hover:translate-y-0 hover:shadow-none")}>
      {children}
      {selected && <span className="absolute right-2.5 top-2.5 flex h-4 w-4 animate-pop items-center justify-center rounded-full bg-accent text-white"><Check size={10} strokeWidth={3} /></span>}
    </button>
  );
}

export function CloudPicker({ byId, value, onChange }: { byId: (id: string) => TechCard | undefined; value: string | null | undefined; onChange: (id: string | null) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {CLOUDS.map((c) => {
        const t = byId(c.id);
        return (
          <BigCard key={c.id} selected={value === c.id} onClick={() => onChange(value === c.id ? null : c.id)}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <TechIcon icon={t?.icon || "cloud"} color={t?.color} size={34} />
              <div className="text-[13px] font-semibold tracking-[-0.01em]">{c.name}</div>
            </div>
          </BigCard>
        );
      })}
    </div>
  );
}

export function PlatformPicker({ byId, cloud, selected, onToggle }: { byId: (id: string) => TechCard | undefined; cloud: string | null | undefined; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {PLATFORMS.map((p) => {
        const t = byId(p.id);
        const ok = platformAvailable(p.id, cloud);
        return (
          <BigCard key={p.id} selected={selected.includes(p.id)} disabled={!ok} onClick={() => onToggle(p.id)}
            title={ok ? t?.description : `Not available on ${CLOUDS.find((c) => c.id === cloud)?.name}`}>
            <TechIcon icon={t?.icon} color={t?.color} size={30} />
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold tracking-[-0.01em]">{t?.name || p.id}</div>
              <div className="truncate text-[11px] text-faint">{ok ? t?.vendor || "" : "Other clouds only"}</div>
            </div>
          </BigCard>
        );
      })}
    </div>
  );
}
