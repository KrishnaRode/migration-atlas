"use client";
import { Boxes, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { stagger } from "@/components/catalog/primitives";
import { Badge, Card, EmptyState, ErrorNote, SectionLabel, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { OllamaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CommandBlock } from "./setup-guide";

type Model = OllamaStatus["models"][number];
const RECOMMENDED_FAMILIES = ["qwen", "llama", "mistral", "gemma", "phi"];

function isRecommended(m: Model, recommended: string[]) {
  const name = m.name.toLowerCase();
  const fam = (m.family || "").toLowerCase();
  return recommended.some((r) => name.startsWith(r.toLowerCase())) || RECOMMENDED_FAMILIES.some((f) => fam.startsWith(f) || name.startsWith(f));
}

function ModelCard({ m, selected, busy, recommended, onSelect, index }: {
  m: Model; selected: boolean; busy: boolean; recommended: boolean; onSelect: () => void; index: number;
}) {
  return (
    <button onClick={onSelect} disabled={busy} style={stagger(index, 40)}
      className={cn("relative flex animate-rise flex-col items-start rounded-2xl border bg-surface p-4 text-left transition-all disabled:cursor-wait",
        selected ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-border hover:-translate-y-0.5 hover:border-border-strong hover:shadow-soft")}>
      <div className="flex w-full items-start gap-2">
        <span className="min-w-0 flex-1 break-all font-mono text-[13px] font-medium">{m.name}</span>
        {busy ? <Spinner size={14} /> : selected && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white"><Check size={12} strokeWidth={3} /></span>}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {m.parameters && <Badge>{m.parameters}</Badge>}
        <Badge>{m.size_gb.toFixed(1)} GB</Badge>
        {m.family && <Badge>{m.family}</Badge>}
        {recommended && <Badge color="var(--modern)"><Sparkles size={10} /> Recommended</Badge>}
      </div>
    </button>
  );
}

export function ModelPicker({ status, onStatus }: { status: OllamaStatus; onStatus: (s: OllamaStatus) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chat = status.models.filter((m) => !m.embedding);
  const embed = status.models.filter((m) => m.embedding);
  const activeChat = status.configured_model || status.selected_model;

  const choose = async (key: string, body: Parameters<typeof api.updateSettings>[0]) => {
    setBusy(key); setError(null);
    try { onStatus(await api.updateSettings(body)); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  if (!status.models.length) {
    return (
      <Card className="p-2">
        <EmptyState icon={Boxes} title="No models installed yet" body="Pull a small, capable model to enable the copilot."
          action={<div className="w-72 text-left"><CommandBlock command="ollama pull qwen3:4b" /></div>} />
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {error && <ErrorNote message={error} />}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Chat model</h2>
            <p className="text-[12.5px] text-muted">Used by the copilot, estate parsing and narratives. Small instruction-tuned models (qwen, llama, mistral, gemma, phi) work well.</p>
          </div>
          <SectionLabel>{chat.length} installed</SectionLabel>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {chat.map((m, i) => (
            <ModelCard key={m.name} m={m} index={i} selected={activeChat === m.name} busy={busy === `chat:${m.name}`}
              recommended={isRecommended(m, status.recommended)} onSelect={() => void choose(`chat:${m.name}`, { ollama_model: m.name })} />
          ))}
        </div>
        {!chat.length && <p className="text-[12.5px] text-muted">Only embedding models are installed. Pull a chat model such as qwen3:4b.</p>}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Embedding model for semantic search</h2>
          <p className="text-[12.5px] text-muted">Optional. When set, knowledge search becomes hybrid (lexical + vector). Without one it stays lexical.</p>
        </div>
        {embed.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {embed.map((m, i) => (
              <ModelCard key={m.name} m={m} index={i} selected={status.embedding_model === m.name} busy={busy === `embed:${m.name}`} recommended={false}
                onSelect={() => void choose(`embed:${m.name}`, { embedding_model: status.embedding_model === m.name ? "" : m.name })} />
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <div className="text-[12.5px] text-muted">No embedding model installed. For semantic search, pull one:</div>
            <div className="max-w-md"><CommandBlock command="ollama pull nomic-embed-text" /></div>
          </Card>
        )}
        {status.embedding_model && embed.length > 0 && <p className="mt-2 text-[11.5px] text-faint">Click the selected embedding model again to turn semantic search off.</p>}
      </section>
    </div>
  );
}
