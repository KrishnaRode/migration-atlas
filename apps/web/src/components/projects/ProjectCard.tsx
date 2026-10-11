"use client";
import { Boxes, GitBranch, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui";
import type { ProjectSummary, TechCard } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { TransitionChips } from "./TechChips";

export function ProjectCard({ p, byId, onDelete, i = 0 }:
  { p: ProjectSummary; byId: (id: string) => TechCard | undefined; onDelete: (id: string) => Promise<void>; i?: number }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try { await onDelete(p.id); } finally { setDeleting(false); setConfirming(false); }
  };

  return (
    <div className="group relative animate-rise" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
      <Link href={`/studio/${p.id}`}
        className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift">
        <div className="flex items-start gap-2 pr-8">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-semibold tracking-[-0.015em]">{p.name}</div>
            <div className="mt-1 line-clamp-2 min-h-[2.6em] text-[12.5px] leading-relaxed text-muted">{p.description || "No description yet."}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {p.industry && <Badge color="var(--accent)">{p.industry}</Badge>}
          {p.sample_id && <Badge>Sample</Badge>}
        </div>
        <div className="mt-4 min-h-6">
          {p.current_technologies.length || p.target.length
            ? <TransitionChips current={p.current_technologies} target={p.target} byId={byId} max={3} />
            : <span className="text-[12px] text-faint">Blank canvas</span>}
        </div>
        <div className="flex-1" />
        <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-[11.5px] text-faint">
          <span className="inline-flex items-center gap-1"><Boxes size={12} /> {p.node_count} nodes</span>
          <span className="inline-flex items-center gap-1"><GitBranch size={12} /> {p.option_count} {p.option_count === 1 ? "option" : "options"}</span>
          <span className="ml-auto">Updated {timeAgo(p.updated_at)}</span>
        </div>
      </Link>

      <div className="absolute right-3 top-3">
        {confirming ? (
          <div className="flex animate-pop items-center gap-1 rounded-lg border border-border bg-surface p-0.5 shadow-soft">
            <button onClick={remove} disabled={deleting}
              className="inline-flex h-6 items-center gap-1 rounded-md bg-bad px-2 text-[11.5px] font-medium text-white hover:opacity-90 disabled:opacity-60">
              {deleting && <Loader2 size={11} className="animate-spin" />} Delete
            </button>
            <button onClick={() => setConfirming(false)} disabled={deleting} className="h-6 rounded-md px-2 text-[11.5px] font-medium text-muted hover:bg-surface-2 hover:text-text">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} title="Delete project" aria-label={`Delete ${p.name}`}
            className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-faint opacity-0 transition-all hover:bg-surface-2 hover:text-bad focus:opacity-100 group-hover:opacity-100")}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="shimmer h-4 w-2/3 rounded-md" />
      <div className="shimmer mt-3 h-3 w-full rounded-md" />
      <div className="shimmer mt-2 h-3 w-4/5 rounded-md" />
      <div className="mt-5 flex gap-1.5">{[0, 1, 2].map((k) => <div key={k} className="shimmer h-6 w-20 rounded-full" />)}</div>
      <div className="shimmer mt-6 h-3 w-1/2 rounded-md" />
    </div>
  );
}
