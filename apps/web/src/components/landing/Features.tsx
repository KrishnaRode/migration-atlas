import { BookOpen, Brain, Download, GitBranch, Layers, Map, Route, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/reveal";
import { STATUS_META } from "@/lib/utils";

type Feature = { icon: LucideIcon; title: string; body: string; extra?: ReactNode; wide?: boolean };

function StatusRow() {
  const items = (["VALID", "VALID_WITH_WARNING", "UNUSUAL", "INVALID"] as const).map((s) => ({ s, ...STATUS_META[s] }));
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {items.map(({ s, color }) => (
        <span key={s} className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium"
          style={{ color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{s}
        </span>
      ))}
    </div>
  );
}

function HealthRow() {
  const dims = [
    { n: "Completeness", l: 3 }, { n: "Governance", l: 2 }, { n: "Security", l: 3 }, { n: "Resilience", l: 1 },
  ];
  const color = (l: number) => (l === 3 ? "var(--ok)" : l === 2 ? "var(--warn)" : "var(--bad)");
  return (
    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
      {dims.map((d) => (
        <div key={d.n} className="flex items-center justify-between gap-2 text-[11px] text-muted">
          {d.n}
          <span className="flex gap-0.5">
            {[1, 2, 3].map((k) => <span key={k} className="h-1.5 w-3 rounded-full" style={{ background: k <= d.l ? color(d.l) : "var(--surface-3)" }} />)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ExportRow() {
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {["PNG", "SVG", "PDF", "Markdown", "JSON"].map((f) => (
        <span key={f} className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">{f}</span>
      ))}
    </div>
  );
}

const FEATURES: Feature[] = [
  { icon: Layers, title: "Domain-aware canvas", body: "Drag from a library of 170+ technologies. Every node knows its category, capabilities and likely successors." },
  { icon: Route, title: "Connection intelligence", body: "Each edge is assessed against migration rules — and tells you why.", extra: <StatusRow /> },
  { icon: Brain, title: "AI architecture generation", body: "A local Ollama model reviews a deterministic draft and proposes improvements. Works fully without AI, too." },
  { icon: ShieldCheck, title: "Validator & health dimensions", body: "Deterministic findings with evidence across dimensions. No single vanity score.", extra: <HealthRow /> },
  { icon: GitBranch, title: "What-if branches & comparison", body: "“What if we used Snowflake?” Branch an option, then compare components, risks and skills side by side." },
  { icon: Map, title: "Migration roadmap waves", body: "Dependency-ordered waves with exit criteria, risks and skills — from coexistence to decommission." },
  { icon: BookOpen, title: "Grounded answers, with citations", body: "Ask the copilot. Answers draw on ingested vendor documentation and cite their sources." },
  { icon: Download, title: "Exports that travel", body: "Diagrams, decision records and the full project — ready for the steering committee or Git.", extra: <ExportRow /> },
];

const TINTS = ["#0071e3", "#00a07d", "#a855f7", "#e08600", "#4f46e5", "#e5333a", "#0891b2", "#1d1d1f"];

export function Features() {
  return (
    <section className="bg-surface-2">
      <div className="mx-auto max-w-[1180px] px-6 py-28 sm:py-36">
        <Reveal className="mx-auto max-w-[760px] text-center">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-accent">Capabilities</div>
          <h2 className="mt-2 text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[56px]">
            Everything an architecture review needs. In one studio.
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 90}
              className={`group rounded-[28px] bg-surface p-7 shadow-soft transition-all duration-700 ease-[var(--ease-apple)] hover:-translate-y-1 hover:shadow-lift ${i === 0 || i === FEATURES.length - 1 ? "lg:col-span-2" : ""}`}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-700 ease-[var(--ease-apple)] group-hover:scale-110"
                style={{ background: `color-mix(in srgb, ${TINTS[i]} 10%, transparent)`, color: TINTS[i] }}>
                <f.icon size={20} strokeWidth={1.9} />
              </div>
              <div className="mt-6 text-[20px] font-semibold leading-tight tracking-[-0.025em]">{f.title}</div>
              <p className="mt-2 text-[15px] leading-[1.5] tracking-[-0.01em] text-muted">{f.body}</p>
              {f.extra}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
