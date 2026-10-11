"use client";
import { CloudOff, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ConnectionCard } from "@/components/settings/connection-card";
import { ModelPicker } from "@/components/settings/model-picker";
import { SetupGuide } from "@/components/settings/setup-guide";
import { PageShell } from "@/components/shell";
import { Card, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import type { OllamaStatus } from "@/lib/types";

export default function SettingsPage() {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    api.ollamaStatus()
      .then((s) => { setStatus(s); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, []);
  useEffect(load, [load]);

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 animate-rise">
          <h1 className="text-[30px] font-semibold tracking-[-0.025em]">Local AI</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Migration Atlas uses <a href="https://ollama.com" target="_blank" rel="noreferrer" className="font-medium text-text hover:text-accent">Ollama</a> on your machine for
            the copilot, estate parsing and narratives. Choose models and check the connection here.
          </p>
        </div>

        <div className="space-y-8">
          {error && !status ? (
            <ErrorNote message={error} onRetry={load} />
          ) : !status ? (
            <div className="space-y-4"><div className="shimmer h-44 rounded-2xl" /><div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="shimmer h-24 rounded-2xl" />)}</div></div>
          ) : (
            <>
              {error && <ErrorNote message={error} onRetry={load} />}
              <ConnectionCard status={status} onStatus={setStatus} onRefresh={load} refreshing={refreshing} />
              {status.reachable ? <ModelPicker status={status} onStatus={setStatus} /> : <SetupGuide steps={status.setup} />}
            </>
          )}

          <Card className="animate-rise p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-modern-soft text-modern"><ShieldCheck size={17} /></div>
              <div>
                <div className="text-[14px] font-semibold">Privacy</div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  Architecture data stays local by default. Migration Atlas never sends estate information to external services.
                  Projects, architectures and the knowledge base are stored on this machine, and prompts go only to the Ollama URL above.
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
                  <CloudOff size={13} className="shrink-0 text-faint" />
                  Optional cloud model providers are a planned adapter — not available or enabled in this build.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
