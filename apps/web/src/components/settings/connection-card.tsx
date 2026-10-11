"use client";
import { CircleCheck, CircleX, PlugZap, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import type { OllamaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type TestResult = Awaited<ReturnType<typeof api.testOllama>>;

export function ConnectionCard({ status, onStatus, onRefresh, refreshing }: {
  status: OllamaStatus; onStatus: (s: OllamaStatus) => void; onRefresh: () => void; refreshing: boolean;
}) {
  const [url, setUrl] = useState(status.base_url);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => setUrl(status.base_url), [status.base_url]);
  const dirty = url.trim() !== status.base_url && url.trim().length > 0;
  const validUrl = /^https?:\/\/\S+$/.test(url.trim());

  const save = async () => {
    setSaving(true); setSaveError(null); setSaved(false);
    try { onStatus(await api.updateSettings({ ollama_base_url: url.trim() })); setSaved(true); setTimeout(() => setSaved(false), 1800); }
    catch (e) { setSaveError((e as Error).message); } finally { setSaving(false); }
  };
  const runTest = async () => {
    setTesting(true); setTest(null); setTestError(null);
    try { setTest(await api.testOllama()); } catch (e) { setTestError((e as Error).message); } finally { setTesting(false); }
  };

  const ok = status.reachable;
  return (
    <Card className="animate-rise overflow-hidden">
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", ok ? "bg-modern-soft text-ok" : "text-warn")}
          style={ok ? undefined : { background: "color-mix(in srgb, var(--warn) 12%, transparent)" }}>
          {ok ? <CircleCheck size={20} /> : <CircleX size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold tracking-[-0.01em]">{ok ? "Connected to Ollama" : "Ollama is not reachable"}</span>
            {status.version && <Badge color="var(--info)">v{status.version}</Badge>}
            {ok && status.selected_model && <Badge color="var(--modern)">{status.selected_model}</Badge>}
          </div>
          <div className="mt-1 text-[12.5px] text-muted">{status.message}</div>
          <div className="mt-0.5 font-mono text-[11.5px] text-faint">{status.base_url}</div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" icon={RefreshCw} loading={refreshing} onClick={onRefresh}>Refresh</Button>
          <Button size="sm" variant="primary" icon={PlugZap} loading={testing} onClick={runTest}>Test connection</Button>
        </div>
      </div>

      {(test || testError) && (
        <div className="border-t border-border px-6 py-4">
          {testError ? <ErrorNote message={testError} onRetry={runTest} /> : test?.ok ? (
            <div className="animate-fade text-[12.5px]">
              <div className="flex items-center gap-2 font-medium text-ok"><CircleCheck size={14} /> Model answered{test.model && <> — <span className="font-mono">{test.model}</span></>}</div>
              {test.sample && <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-surface-2 p-3 font-mono text-[11.5px] text-muted">{test.sample}</pre>}
            </div>
          ) : <ErrorNote message={test?.error || "The model did not answer."} onRetry={runTest} />}
        </div>
      )}

      <div className="border-t border-border bg-surface-2/40 px-6 py-4">
        <label htmlFor="ollama-url" className="text-[12px] font-medium text-muted">Ollama base URL</label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input id="ollama-url" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false}
            onKeyDown={(e) => e.key === "Enter" && dirty && validUrl && void save()}
            className="h-9 flex-1 rounded-[10px] border border-border bg-surface px-3 font-mono text-[12.5px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]" />
          <Button icon={Save} loading={saving} disabled={!dirty || !validUrl} onClick={save}>{saved ? "Saved" : "Save"}</Button>
        </div>
        {dirty && !validUrl && <div className="mt-1.5 text-[11.5px] text-warn">Enter a full URL such as http://127.0.0.1:11434</div>}
        {saveError && <div className="mt-2"><ErrorNote message={saveError} /></div>}
      </div>
    </Card>
  );
}
