"use client";
import { Sparkles, X } from "lucide-react";
import { Button, SectionLabel, TechIcon } from "@/components/ui";
import { techName } from "@/components/projects/TechChips";
import type { Estate, TechCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EXAMPLE_TEXT } from "./estate";

function DetectedChip({ id, tech, ai, onRemove }: { id: string; tech?: TechCard; ai?: boolean; onRemove: () => void }) {
  return (
    <span className="group inline-flex h-7 animate-pop items-center gap-1.5 rounded-full border border-border bg-surface pl-0.5 pr-1 text-[12px] font-medium shadow-soft">
      <TechIcon icon={tech?.icon} color={tech?.color} size={22} className="rounded-full" />
      {techName(id, tech)}
      {ai && <span className="rounded px-1 text-[9px] font-semibold uppercase tracking-wide text-accent" style={{ background: "var(--accent-soft)" }} title="Found by local AI">AI</span>}
      <button onClick={onRemove} aria-label={`Remove ${techName(id, tech)}`}
        className="flex h-5 w-5 items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-text">
        <X size={11} />
      </button>
    </span>
  );
}

export function DescribePanel({ text, onText, onExtract, aiBusy, aiNote, estate, sources, byId, onRemoveTech }: {
  text: string; onText: (t: string) => void; onExtract: () => void; aiBusy: boolean; aiNote: string | null;
  estate: Estate; sources: Record<string, "rules" | "ai">; byId: (id: string) => TechCard | undefined; onRemoveTech: (id: string) => void;
}) {
  const targets = [estate.target_cloud, ...estate.target_platforms].filter((x): x is string => !!x);
  const groups = [
    { label: "Current", ids: estate.current_technologies, empty: "Legacy systems you mention appear here." },
    { label: "Target", ids: targets, empty: "Clouds and platforms you're heading to." },
  ];
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em]">Describe your estate</h2>
        <button onClick={() => onText(EXAMPLE_TEXT)} className="text-[12px] font-medium text-accent hover:underline">Use example</button>
      </div>
      <div className="relative rounded-2xl border border-border bg-surface shadow-soft transition-shadow focus-within:border-border-strong focus-within:shadow-lift">
        <textarea value={text} onChange={(e) => onText(e.target.value)} rows={7} placeholder={EXAMPLE_TEXT}
          className="block w-full resize-none rounded-2xl bg-transparent px-5 pb-16 pt-4 text-[14.5px] leading-relaxed text-text outline-none placeholder:text-faint" />
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
          <span className="truncate pl-2 text-[11px] text-faint">{aiBusy ? "Local models can take ~10s." : "Chips update live as you type."}</span>
          <Button variant="primary" size="sm" icon={Sparkles} loading={aiBusy} disabled={!text.trim()} onClick={onExtract}>
            {aiBusy ? "Reading your estate…" : "Extract with local AI"}
          </Button>
        </div>
      </div>
      {aiNote && <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-faint animate-fade">{aiNote}</p>}

      <div className="mt-6 space-y-5">
        {groups.map((g) => (
          <div key={g.label}>
            <SectionLabel className="mb-2">{g.label}{g.ids.length ? ` · ${g.ids.length}` : ""}</SectionLabel>
            {g.ids.length ? (
              <div className="flex flex-wrap gap-1.5">
                {g.ids.map((id) => <DetectedChip key={id} id={id} tech={byId(id)} ai={sources[id] === "ai"} onRemove={() => onRemoveTech(id)} />)}
              </div>
            ) : (
              <div className={cn("rounded-xl border border-dashed border-border px-3 py-2.5 text-[12px] text-faint")}>{g.empty}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
