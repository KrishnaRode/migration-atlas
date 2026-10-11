"use client";
import { Check, MessageSquare, Sparkles, X, Cpu } from "lucide-react";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { useStudio } from "@/lib/studio-store";
import type { Proposal } from "@/lib/types";

/** AI/rules proposals are never applied silently: Apply · Dismiss · Explain. */
export function ProposalCard({ proposal, onDismiss }: { proposal: Proposal; onDismiss?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const techIndex = useStudio((s) => s.techIndex);
  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      await useStudio.getState().applyProposal(proposal);
      onDismiss?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const adds = proposal.operations.filter((o) => o.op === "add_node" && o.tech_id).map((o) => techIndex[o.tech_id!]?.name || o.tech_id);
  return (
    <div className="animate-rise rounded-xl border border-border bg-surface p-3 shadow-soft">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          {proposal.source === "ai" ? <Sparkles size={13} /> : <Cpu size={13} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold leading-snug">{proposal.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <Badge color={proposal.source === "ai" ? "var(--accent)" : "var(--modern)"}>{proposal.source === "ai" ? "Local AI" : "Rule engine"}</Badge>
            <Badge>{proposal.confidence} confidence</Badge>
          </div>
        </div>
      </div>
      <div className="mt-2 text-[12px] leading-relaxed text-muted"><span className="font-medium text-text">Reason: </span>{proposal.reason}</div>
      {proposal.evidence.length > 0 && (
        <details className="mt-1.5 text-[11.5px] text-muted">
          <summary className="cursor-pointer select-none text-faint hover:text-muted">Evidence ({proposal.evidence.length})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">{proposal.evidence.slice(0, 4).map((e, i) => <li key={i}>{e}</li>)}</ul>
        </details>
      )}
      {adds.length > 0 && <div className="mt-1.5 text-[11px] text-faint">Adds: {adds.join(", ")}</div>}
      {error && <div className="mt-1.5 text-[11.5px] text-bad">{error}</div>}
      <div className="mt-2.5 flex gap-1.5">
        <Button size="sm" variant="primary" icon={Check} loading={busy} onClick={apply}>Apply</Button>
        {onDismiss && <Button size="sm" variant="ghost" icon={X} onClick={onDismiss}>Dismiss</Button>}
        <Button size="sm" variant="ghost" icon={MessageSquare}
          onClick={() => useStudio.getState().askAI(`Explain this proposal and its trade-offs: "${proposal.title}". Reason given: ${proposal.reason}`)}>Explain</Button>
      </div>
    </div>
  );
}
