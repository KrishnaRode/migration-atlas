"use client";
import { CircleCheck, CircleSlash, CircleX } from "lucide-react";
import type { api } from "@/lib/api";

export type IngestResponse = Awaited<ReturnType<typeof api.ingest>>;
export type IngestRun = IngestResponse["results"][number];

function Rows({ items, color, icon }: { items: { url: string; reason?: string }[]; color: string; icon: React.ReactNode }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {items.slice(0, 8).map((it, i) => (
        <li key={`${it.url}-${i}`} className="flex gap-1.5 text-[11.5px]">
          <span className="mt-[2px] shrink-0" style={{ color }}>{icon}</span>
          <span className="min-w-0"><span className="break-all font-mono text-text">{it.url}</span>{it.reason && <span className="text-muted"> — {it.reason}</span>}</span>
        </li>
      ))}
      {items.length > 8 && <li className="pl-5 text-[11px] text-faint">+{items.length - 8} more</li>}
    </ul>
  );
}

export function IngestSummary({ runs }: { runs: IngestRun[] }) {
  return (
    <div className="space-y-2.5">
      {runs.map((r, i) => (
        <div key={i} className="animate-rise rounded-xl border border-border bg-surface-2/60 p-3">
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <span className="font-semibold">{r.source_id ?? "Unregistered URLs"}</span>
            <span className="inline-flex items-center gap-1 text-ok"><CircleCheck size={12} /> {r.ingested.length} ingested</span>
            <span className="inline-flex items-center gap-1 text-warn"><CircleSlash size={12} /> {r.skipped.length} skipped</span>
            <span className="inline-flex items-center gap-1 text-bad"><CircleX size={12} /> {r.errors.length} errors</span>
            <span className="ml-auto font-mono text-[11px] text-faint">{r.status}</span>
          </div>
          {r.ingested.length > 0 && <Rows items={r.ingested.map((url) => ({ url }))} color="var(--ok)" icon={<CircleCheck size={11} />} />}
          {r.skipped.length > 0 && <Rows items={r.skipped} color="var(--warn)" icon={<CircleSlash size={11} />} />}
          {r.errors.length > 0 && <Rows items={r.errors} color="var(--bad)" icon={<CircleX size={11} />} />}
        </div>
      ))}
    </div>
  );
}
