"use client";
import { ArrowRight } from "lucide-react";
import { TechIcon } from "@/components/ui";
import type { TechCard } from "@/lib/types";
import { CLOUD_NAMES, cn } from "@/lib/utils";

/** Human name for a tech id even before the ontology has loaded. */
export function techName(id: string, tech?: TechCard) {
  if (tech) return tech.name;
  if (CLOUD_NAMES[id]) return CLOUD_NAMES[id];
  return id.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export function TechChip({ id, tech, muted, className }: { id: string; tech?: TechCard; muted?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-surface pl-0.5 pr-2 text-[11.5px] font-medium text-text", className)}
      title={tech ? `${tech.name} · ${tech.vendor}` : undefined}>
      <TechIcon icon={tech?.icon} color={tech?.color} size={20} muted={muted} className="rounded-full" />
      <span className={cn("truncate", muted && "text-muted")}>{techName(id, tech)}</span>
    </span>
  );
}

/** "current → target" chip row used by project and sample cards. */
export function TransitionChips({ current, target, byId, max = 4 }:
  { current: string[]; target: string[]; byId: (id: string) => TechCard | undefined; max?: number }) {
  const cur = current.slice(0, max);
  const more = current.length - cur.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {cur.map((id) => <TechChip key={id} id={id} tech={byId(id)} muted />)}
      {more > 0 && <span className="text-[11px] text-faint">+{more}</span>}
      {target.length > 0 && <ArrowRight size={13} className="mx-0.5 text-faint" />}
      {target.map((id) => <TechChip key={id} id={id} tech={byId(id)} />)}
    </div>
  );
}
