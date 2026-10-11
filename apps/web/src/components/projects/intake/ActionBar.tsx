"use client";
import { ArrowRight, Cpu } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function ActionBar({ name, suggestion, onName, summary, useAi, onUseAi, canGenerate, busy, onGenerate }: {
  name: string; suggestion: string; onName: (v: string) => void; summary: string;
  useAi: boolean; onUseAi: (v: boolean) => void; canGenerate: boolean; busy: boolean; onGenerate: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-30 mt-10">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/85 p-3 shadow-lift backdrop-blur-xl md:flex-row md:items-center">
        <div className="min-w-0 flex-1 md:pl-1">
          <input value={name} onChange={(e) => onName(e.target.value)} placeholder={suggestion} aria-label="Project name"
            className="w-full truncate bg-transparent text-[14px] font-semibold tracking-[-0.01em] text-text outline-none placeholder:text-text/60" />
          <div className="mt-0.5 truncate text-[12px] text-faint">{summary || "Nothing selected yet — describe your estate or pick technologies."}</div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <button role="switch" aria-checked={useAi} onClick={() => onUseAi(!useAi)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text">
            <Cpu size={13} className={useAi ? "text-accent" : "text-faint"} />
            Use local AI review
            <span className={cn("relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors", useAi ? "bg-accent" : "bg-surface-3")}>
              <span className={cn("absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform", useAi ? "translate-x-[15px]" : "translate-x-[2px]")} />
            </span>
          </button>
          <Button variant="primary" size="lg" disabled={!canGenerate} loading={busy} onClick={onGenerate}>
            Generate target architecture {!busy && <ArrowRight size={15} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
