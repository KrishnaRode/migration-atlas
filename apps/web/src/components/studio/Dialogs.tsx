"use client";
import { ArrowRight, CheckCircle2, CircleAlert, GitBranch, Info, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, ErrorNote, Modal, Spinner, TechIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { useStudio } from "@/lib/studio-store";
import type { ArchitectureDecision, MigrationMapping, TechCard } from "@/lib/types";
import { uid } from "@/lib/utils";

type Candidate = TechCard & { mapping: MigrationMapping | null; cloud_compatible: boolean };

export function ReplaceDialog() {
  const nodeId = useStudio((s) => s.replaceFor);
  const node = useStudio((s) => s.nodes.find((n) => n.id === s.replaceFor));
  const [items, setItems] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setItems(null);
    setError(null);
    if (!node) return;
    const cloud = useStudio.getState().architecture()?.meta.target_cloud;
    api.replacements(node.data.arch.tech_id, cloud).then(setItems).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);
  if (!node) return null;
  const close = () => useStudio.getState().set({ replaceFor: null });
  const choose = async (t: Candidate) => {
    setBusy(t.id);
    try {
      const st = useStudio.getState();
      const changes = await st.replaceNode(node.id, t.id);
      st.toast({ title: `${node.data.tech?.name} → ${t.name}`, body: changes.slice(0, 2).join(" "), tone: "ok",
        action: { label: "Record ADR", run: () => st.set({ adrDraft: {
          title: `Use ${t.name} instead of ${node.data.tech?.name}`, related_nodes: [node.id],
          context: `${node.data.tech?.name} is part of the current design. ${t.mapping?.approaches[0] || ""}`.trim(),
          decision: `Replace ${node.data.tech?.name} with ${t.name}.`, consequences: changes.slice(0, 4),
          alternatives: (items || []).filter((x) => x.id !== t.id).slice(0, 3).map((x) => x.name) } }) } });
      st.askAI(`We replaced ${node.data.tech?.name} with ${t.name}. Describe what changes operationally and what the team should plan for.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal open onClose={close} title={`Replace ${node.data.tech?.name}`} width={620}>
      <p className="mb-3 text-[12.5px] text-muted">Alternatives from the ontology. Compatible connections are preserved; connections that no longer make sense are removed and reported.</p>
      {error && <ErrorNote message={error} />}
      {!items && !error && <div className="flex items-center gap-2 py-6 text-[12.5px] text-muted"><Spinner /> Finding alternatives…</div>}
      <div className="space-y-1.5">
        {items?.map((t) => (
          <button key={t.id} onClick={() => choose(t)} disabled={!!busy}
            className="group flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition-all hover:border-accent hover:shadow-soft disabled:opacity-60">
            <TechIcon icon={t.icon} color={t.color} size={34} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold">{t.name}</span>
                <span className="text-[11px] text-faint">{t.vendor}</span>
                {!t.cloud_compatible && <Badge color="var(--warn)">other cloud</Badge>}
                {t.mapping && <Badge color="var(--modern)">{t.mapping.automation_potential} automation</Badge>}
              </div>
              <div className="mt-0.5 line-clamp-2 text-[12px] text-muted">{t.mapping?.approaches[0] || t.description}</div>
            </div>
            {busy === t.id ? <Spinner /> : <ArrowRight size={15} className="mt-2 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />}
          </button>
        ))}
      </div>
    </Modal>
  );
}

const WHAT_IFS = [
  "What if we use BigQuery instead?", "What if Snowflake is the target?", "What if Databricks runs on Azure?",
  "What if we retain Informatica?", "What if we avoid Kafka?", "What if downtime must be under 30 minutes?",
];

export function WhatIfDialog() {
  const open = useStudio((s) => s.whatIfOpen);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  const close = () => { useStudio.getState().set({ whatIfOpen: false }); setError(null); };
  const run = async (question: string) => {
    const st = useStudio.getState();
    const arch = st.architecture();
    if (!arch || !st.project) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.whatIf(arch, st.project.estate, question, false);
      await st.addOption(res.architecture);
      st.toast({ title: "New what-if branch", body: `${res.changes.join(" · ")}. +${res.added.length} / −${res.removed.length} components. The original is untouched.`, tone: "info",
        action: { label: "Compare", run: () => st.setView("compare") } });
      close();
      setQ("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={close} title="What if…?" width={560}>
      <p className="mb-3 text-[12.5px] text-muted">Explore a scenario as a new architecture branch. The current option is never modified.</p>
      <div className="flex gap-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q.trim() && run(q)}
          placeholder="What if we use BigQuery instead?" className="h-10 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-accent focus:bg-surface" />
        <Button variant="primary" icon={GitBranch} loading={busy} disabled={!q.trim()} onClick={() => run(q)}>Branch</Button>
      </div>
      {error && <div className="mt-3"><ErrorNote message={error} /></div>}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {WHAT_IFS.map((w) => (
          <button key={w} onClick={() => run(w)} disabled={busy}
            className="rounded-full border border-border px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-50">{w}</button>
        ))}
      </div>
    </Modal>
  );
}

export function AdrDialog() {
  const draft = useStudio((s) => s.adrDraft);
  const decisions = useStudio((s) => s.project?.decisions) || [];
  const [form, setForm] = useState<Partial<ArchitectureDecision>>({});
  useEffect(() => { if (draft) setForm({ status: "proposed", alternatives: [], consequences: [], ...draft }); }, [draft]);
  if (!draft) return null;
  const close = () => useStudio.getState().set({ adrDraft: null });
  const save = () => {
    const st = useStudio.getState();
    const existing = decisions.find((d) => d.id === form.id);
    const number = existing?.number || Math.max(0, ...decisions.map((d) => d.number)) + 1;
    const adr: ArchitectureDecision = {
      id: form.id || uid("adr"), number, title: form.title || "Untitled decision", status: form.status || "proposed",
      context: form.context || "", decision: form.decision || "", alternatives: form.alternatives || [], consequences: form.consequences || [],
      related_nodes: form.related_nodes || [], created_at: existing?.created_at || new Date().toISOString(),
    };
    st.setDecisions(existing ? decisions.map((d) => (d.id === adr.id ? adr : d)) : [...decisions, adr]);
    st.toast({ title: `ADR-${String(number).padStart(3, "0")} saved`, body: adr.title, tone: "ok" });
    close();
  };
  const field = "w-full rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[12.5px] outline-none focus:border-accent focus:bg-surface";
  const list = (k: "alternatives" | "consequences") => (
    <textarea rows={3} className={field} value={(form[k] || []).join("\n")} placeholder="One per line"
      onChange={(e) => setForm({ ...form, [k]: e.target.value.split("\n").filter((x, i, a) => x.trim() || i === a.length - 1) })} />
  );
  return (
    <Modal open onClose={close} title={form.id ? "Edit decision" : "Record architecture decision"} width={620}>
      <div className="space-y-3">
        <input className={field} value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Use Databricks Workflows instead of Control-M" />
        <div className="flex gap-1">
          {(["proposed", "accepted", "superseded", "rejected"] as const).map((s) => (
            <button key={s} onClick={() => setForm({ ...form, status: s })}
              className={`h-7 rounded-md px-2.5 text-[11.5px] font-medium capitalize ${form.status === s ? "bg-accent text-white" : "border border-border text-muted"}`}>{s}</button>
          ))}
        </div>
        <div><div className="mb-1 text-[11px] font-medium text-faint">Context</div><textarea rows={3} className={field} value={form.context || ""} onChange={(e) => setForm({ ...form, context: e.target.value })} /></div>
        <div><div className="mb-1 text-[11px] font-medium text-faint">Decision</div><textarea rows={2} className={field} value={form.decision || ""} onChange={(e) => setForm({ ...form, decision: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><div className="mb-1 text-[11px] font-medium text-faint">Alternatives considered</div>{list("alternatives")}</div>
          <div><div className="mb-1 text-[11px] font-medium text-faint">Consequences</div>{list("consequences")}</div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save ADR</Button>
        </div>
      </div>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useStudio((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => {
        const Icon = t.tone === "bad" ? CircleAlert : t.tone === "warn" ? CircleAlert : t.tone === "info" ? Info : CheckCircle2;
        const color = t.tone === "bad" ? "var(--bad)" : t.tone === "warn" ? "var(--warn)" : t.tone === "info" ? "var(--accent)" : "var(--ok)";
        return (
          <div key={t.id} className="pointer-events-auto flex max-w-[520px] animate-rise items-start gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-lift">
            <Icon size={16} style={{ color }} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold">{t.title}</div>
              {t.body && <div className="mt-0.5 text-[12px] text-muted">{t.body}</div>}
            </div>
            {t.action && <button onClick={() => { t.action!.run(); useStudio.getState().dismissToast(t.id); }} className="shrink-0 text-[12px] font-semibold text-accent hover:underline">{t.action.label}</button>}
            <button onClick={() => useStudio.getState().dismissToast(t.id)} className="shrink-0 text-faint hover:text-text"><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}

const STEPS = [
  { step: "rules", label: "Deterministic architecture rules" },
  { step: "ontology", label: "Technology ontology" },
  { step: "graph", label: "Knowledge graph" },
  { step: "rag", label: "Documentation retrieval" },
  { step: "ai", label: "Local AI reasoning" },
  { step: "validate", label: "Validation & fit to your priorities" },
];

/** Shown while the hybrid pipeline runs. Steps tick on a timer until the real result arrives. */
export function GenerationOverlay({ running, useAi, done }: { running: boolean; useAi: boolean; done: { step: string; detail: string }[] | null }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    setTick(0);
    const t = setInterval(() => setTick((x) => x + 1), 700);
    return () => clearInterval(t);
  }, [running]);
  if (!running && !done) return null;
  const active = done ? STEPS.length : Math.min(useAi ? 4 : 5, tick);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[color-mix(in_srgb,var(--canvas)_75%,transparent)] backdrop-blur-[3px] animate-fade">
      <div className="w-[400px] animate-pop rounded-2xl border border-border bg-surface p-5 shadow-lift">
        <div className="flex items-center gap-2 text-[14px] font-semibold"><Sparkles size={16} className="text-accent" /> Designing architecture options</div>
        <div className="mt-1 text-[12px] text-muted">Several distinct options — requested target, an alternative platform and a low-rewrite path — scored against your priorities.</div>
        <div className="mt-4 space-y-2.5">
          {STEPS.map((s, i) => {
            const state = i < active ? "done" : i === active ? "active" : "todo";
            const detail = done?.find((d) => d.step === s.step)?.detail;
            return (
              <div key={s.step} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {state === "done" ? <CheckCircle2 size={16} className="text-ok" /> : state === "active" ? <Spinner size={14} /> : <span className="h-2 w-2 rounded-full bg-surface-3" />}
                </span>
                <div className="min-w-0">
                  <div className={`text-[12.5px] ${state === "todo" ? "text-faint" : "font-medium"}`}>{s.label}{s.step === "ai" && !useAi && " (off)"}</div>
                  {detail && <div className="text-[11px] text-faint">{detail}</div>}
                  {s.step === "ai" && state === "active" && <div className="text-[11px] text-faint">The local model is reviewing the draft — usually 15–40s.</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
