"use client";
import { ArrowUp, BookOpen, Cpu, ExternalLink, GitBranch, GraduationCap, Link2, Sparkles, Square, Star, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge, Segmented, Spinner } from "@/components/ui";
import { api, streamChat } from "@/lib/api";
import { useStudio } from "@/lib/studio-store";
import type { ChatMessage, Citation, OptionAnalysis, Persona, Proposal } from "@/lib/types";
import { Markdown } from "./Markdown";
import { ProposalCard } from "./ProposalCard";

const QUESTIONS = [
  "Which option is the best fit for us?",
  "Why did you add this component?",
  "Where are the major migration risks?",
  "What happens if we need near-real-time ingestion?",
  "How would this architecture look on Azure?",
  "Explain this architecture to a CTO.",
  "What can replace Informatica?",
];
const ACTIONS = [
  "Add missing governance", "Add reconciliation", "Add monitoring", "Add a streaming layer",
  "Add disaster recovery", "Remove unnecessary staging", "Reduce infrastructure complexity", "Suggest a lower-cost alternative",
];

interface Turn extends ChatMessage {
  proposals?: Proposal[]; pending?: boolean; error?: string; model?: string | null; intent?: string;
  whatIf?: { question: string; changes: string[] }; fit?: OptionAnalysis; playbooks?: { id: string; title: string }[];
}

export function CopilotPanel() {
  const persona = useStudio((s) => s.persona);
  const seed = useStudio((s) => s.chatSeed);
  const selectedNodeId = useStudio((s) => s.selectedNodeId);
  const selectedEdgeId = useStudio((s) => s.selectedEdgeId);
  const focusLabel = useStudio((s) => {
    if (s.selectedEdgeId) {
      const e = s.edges.find((x) => x.id === s.selectedEdgeId);
      const n = (id?: string) => s.nodes.find((x) => x.id === id);
      const a = n(e?.source), b = n(e?.target);
      return e ? `${a?.data.arch.label || a?.data.tech?.name} → ${b?.data.arch.label || b?.data.tech?.name}` : null;
    }
    const node = s.nodes.find((x) => x.id === s.selectedNodeId);
    return node ? node.data.arch.label || node.data.tech?.name || null : null;
  });
  const initial = useStudio.getState().project?.conversations || [];
  const [turns, setTurns] = useState<Turn[]>(initial as Turn[]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Persist finished conversations (outside render, once a turn completes).
  useEffect(() => {
    if (!busy) persist(turns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [turns]);
  useEffect(() => {
    if (seed) void send(seed.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  const persist = (all: Turn[]) => useStudio.getState().setConversations(
    all.filter((t) => !t.pending && !t.error && t.content).slice(-40).map(({ role, content, persona: p, citations, created_at }) => ({ role, content, persona: p, citations, created_at })));

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    const st = useStudio.getState();
    const now = new Date().toISOString();
    const user: Turn = { role: "user", content: msg, persona: st.persona, citations: [], created_at: now };
    const draft: Turn = { role: "assistant", content: "", persona: st.persona, citations: [], created_at: now, pending: true };
    const history = turns.filter((t) => !t.error).map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, user, draft]);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const update = (patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) =>
      setTurns((all) => all.map((t, i) => (i === all.length - 1 ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
    const current = st.architecture();
    const options = (st.project?.options || []).map((o) => (o.id === current?.id ? current : o));
    await streamChat({
      message: msg, persona: st.persona, architecture: current, estate: st.project?.estate, options,
      selected_node_id: st.selectedNodeId, selected_edge_id: st.selectedEdgeId, history,
    }, {
      onMeta: (m) => update({ citations: m.citations, model: m.model, playbooks: m.playbooks }),
      onIntent: (intent) => update({ intent }),
      onAction: (a) => {
        if (a.type === "proposals") update({ proposals: a.proposals });
        else if (a.type === "what_if") update({ whatIf: { question: a.question, changes: a.changes } });
        else if (a.type === "fit") update({ fit: a.analysis });
      },
      onToken: (tok) => update((t) => ({ content: t.content + tok })),
      onDone: () => update({ pending: false }),
      onError: (e) => update({ pending: false, error: e.message }),
    }, ctrl.signal);
    update({ pending: false });
    setBusy(false);
  }

  async function propose(request: string) {
    if (busy) return;
    const st = useStudio.getState();
    const arch = st.architecture();
    if (!arch) return;
    const now = new Date().toISOString();
    setTurns((t) => [...t, { role: "user", content: request, citations: [], created_at: now },
      { role: "assistant", content: "", citations: [], created_at: now, pending: true }]);
    setBusy(true);
    try {
      const res = await api.propose(arch, st.project?.estate || null, request, true);
      setTurns((all) => all.map((t, i) => (i === all.length - 1 ? {
        ...t, pending: false, proposals: res.proposals,
        content: res.proposals.length
          ? `I found ${res.proposals.length} change${res.proposals.length > 1 ? "s" : ""} worth considering. Nothing is applied until you choose **Apply**.`
          : `I couldn't find a safe change for that request.${res.ai_note ? ` (${res.ai_note})` : ""}`,
      } : t)));
    } catch (e) {
      setTurns((all) => all.map((t, i) => (i === all.length - 1 ? { ...t, pending: false, error: (e as Error).message } : t)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <Segmented<Persona> size="sm" value={persona} onChange={(p) => useStudio.getState().setPersona(p)}
          options={[{ value: "developer", label: "Developer" }, { value: "architect", label: "Architect" }, { value: "leader", label: "Leader" }]} />
        {turns.length > 0 && <button onClick={() => { setTurns([]); persist([]); }} className="text-[11px] text-faint hover:text-text">Clear</button>}
      </div>
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!turns.length && (
          <div className="animate-fade space-y-4 pt-2">
            <div className="rounded-2xl bg-surface-2 p-3.5">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold"><Sparkles size={14} className="text-accent" /> Architecture copilot</div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                Answers use your architecture, the technology ontology, the knowledge graph and local documentation — with citations.
                Select a component or connection to focus the question. Runs entirely on your local model.
              </p>
            </div>
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">Ask</div>
              <div className="flex flex-wrap gap-1.5">{QUESTIONS.map((q) => <Chip key={q} onClick={() => send(q)}>{q}</Chip>)}</div>
            </div>
          </div>
        )}
        {turns.map((t, i) => <TurnView key={i} turn={t} />)}
      </div>
      <div className="border-t border-border p-2.5">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {ACTIONS.map((a) => (
            <button key={a} onClick={() => propose(a)} disabled={busy}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50">
              <Wand2 size={11} /> {a}
            </button>
          ))}
        </div>
        {focusLabel && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted">
            <Link2 size={11} className="text-accent" /> Asking about <span className="font-medium text-text">{focusLabel}</span>
            <button onClick={() => useStudio.getState().select(null, null)} className="text-faint hover:text-text"><X size={11} /></button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-border bg-surface-2 p-1.5 transition-colors focus-within:border-accent focus-within:bg-surface">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={selectedNodeId || selectedEdgeId ? "Ask about the selection…" : "Ask about this architecture…"}
            className="max-h-28 min-h-[30px] flex-1 resize-none bg-transparent px-1.5 py-1 text-[12.5px] outline-none placeholder:text-faint" />
          {busy ? (
            <button onClick={() => abortRef.current?.abort()} className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-muted"><Square size={12} /></button>
          ) : (
            <button onClick={() => send(input)} disabled={!input.trim()} className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-40"><ArrowUp size={14} /></button>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-faint"><Cpu size={10} /> Local model via Ollama · nothing leaves this machine</div>
      </div>
    </div>
  );
}

function Chip({ children, onClick }: { children: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-full border border-border bg-surface px-2.5 py-1 text-left text-[11.5px] text-muted transition-colors hover:border-accent hover:text-text">{children}</button>;
}

function TurnView({ turn }: { turn: Turn }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  if (turn.role === "user") {
    return <div className="ml-8 animate-rise rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[12.5px] leading-relaxed text-white">{turn.content}</div>;
  }
  return (
    <div className="animate-rise space-y-2">
      <div className="flex items-center gap-1.5 text-[10.5px] text-faint">
        <Sparkles size={11} className="text-accent" /> Copilot {turn.persona && <Badge>{turn.persona}</Badge>} {turn.model && <span className="font-mono">{turn.model}</span>}
      </div>
      {turn.pending && !turn.content && (
        <div className="flex items-center gap-2 text-[12px] text-muted"><Spinner size={13} /> Thinking locally… small models can take a few seconds to start.</div>
      )}
      {turn.content && <Markdown text={turn.content} />}
      {turn.error && <div className="rounded-lg bg-surface-2 px-2.5 py-2 text-[12px] text-bad">{turn.error}{turn.error.includes("Ollama") && " Open Settings for setup steps."}</div>}
      {turn.whatIf && <WhatIfCard q={turn.whatIf.question} changes={turn.whatIf.changes} />}
      {turn.fit && <FitCard analysis={turn.fit} />}
      {turn.proposals?.filter((p) => !dismissed.includes(p.id)).map((p) => (
        <ProposalCard key={p.id} proposal={p} onDismiss={() => setDismissed([...dismissed, p.id])} />
      ))}
      {turn.playbooks && turn.playbooks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[10.5px] text-faint">
          <GraduationCap size={11} /> Playbooks:
          {turn.playbooks.map((p) => <span key={p.id} className="rounded-full bg-surface-2 px-2 py-[1px] text-muted" title={p.title}>{p.title.split(" (")[0]}</span>)}
        </div>
      )}
      {turn.citations.length > 0 && <Citations items={turn.citations} />}
    </div>
  );
}

function WhatIfCard({ q, changes }: { q: string; changes: string[] }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    const st = useStudio.getState();
    const arch = st.architecture();
    if (!arch || !st.project) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.whatIf(arch, st.project.estate, q, false);
      await st.addOption(res.architecture);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="animate-rise rounded-xl border border-border bg-surface p-3 shadow-soft">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold"><GitBranch size={14} className="text-accent" /> Scenario branch</div>
      <ul className="mt-1.5 space-y-0.5 text-[12px] text-muted">{changes.map((c) => <li key={c}>• {c}</li>)}</ul>
      {error && <div className="mt-1.5 text-[11.5px] text-bad">{error}</div>}
      <button onClick={create} disabled={busy || done}
        className="mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-full bg-accent px-3 text-[12px] font-medium text-white disabled:opacity-60">
        {done ? "Branch created" : busy ? "Creating…" : "Create branch"}
      </button>
      <span className="ml-2 text-[11px] text-faint">Your current option is never changed.</span>
    </div>
  );
}

function FitCard({ analysis }: { analysis: OptionAnalysis }) {
  const best = analysis.fits.find((f) => f.option_id === analysis.recommended_option_id);
  return (
    <div className="animate-rise space-y-1.5 rounded-xl border border-border bg-surface p-3 shadow-soft">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold"><Star size={12} className="text-modern" fill="currentColor" /> Fit to your priorities</div>
      {analysis.fits.map((f) => (
        <button key={f.option_id} onClick={() => useStudio.getState().switchOption(f.option_id)}
          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-surface-2 text-[10px] font-bold">{f.label}</span>
          <span className="min-w-0 flex-1 truncate text-[12px]">{f.name.replace(/^Option [A-Z] · /, "")}</span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full" style={{ width: `${f.fit_percent}%`, background: f === best ? "var(--modern)" : "var(--accent)" }} /></span>
          <span className={`w-9 text-right text-[11.5px] font-semibold tabular-nums ${f === best ? "text-modern" : "text-muted"}`}>{f.fit_percent}%</span>
        </button>
      ))}
      <button onClick={() => useStudio.getState().setView("compare")} className="text-[11.5px] font-medium text-accent hover:underline">See evidence for every score →</button>
    </div>
  );
}

function Citations({ items }: { items: Citation[] }) {
  return (
    <div className="space-y-1 rounded-xl border border-border p-2">
      <div className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint"><BookOpen size={11} /> Sources</div>
      {items.map((c, i) => (
        <a key={i} href={c.url} target="_blank" rel="noreferrer" className="group flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-surface-2">
          <span className="cite mt-0.5 shrink-0 rounded-[5px] bg-accent-soft px-1 text-[10px] font-semibold text-accent">S{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11.5px] font-medium">{c.title}</div>
            <div className="truncate text-[10.5px] text-faint">{c.vendor} · {c.doc_type === "curated-note" ? "Curated note" : c.doc_type} · retrieved {c.retrieved_at.slice(0, 10)}</div>
          </div>
          <ExternalLink size={11} className="mt-1 shrink-0 text-faint opacity-0 group-hover:opacity-100" />
        </a>
      ))}
    </div>
  );
}
