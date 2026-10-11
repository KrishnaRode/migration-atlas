import { BookOpen, Brain, Download, GitBranch, Layers, Map, Route, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
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

export function Features() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-24">
      <div className="max-w-[620px]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Capabilities</div>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
          Everything an architecture review needs, in one studio.
        </h2>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="group rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent transition-transform group-hover:scale-105">
              <f.icon size={17} strokeWidth={1.9} />
            </div>
            <div className="mt-4 text-[14.5px] font-semibold tracking-[-0.015em]">{f.title}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{f.body}</p>
            {f.extra}
          </div>
        ))}
      </div>
    </section>
  );
}
