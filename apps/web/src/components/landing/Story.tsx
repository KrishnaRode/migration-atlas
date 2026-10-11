import { Box, Cpu, Database, Lock, ShieldCheck, Sparkles, WifiOff } from "lucide-react";
import { Reveal } from "@/components/reveal";

/** Typographic statement on a light-gray band: why Migration Atlas exists. */
export function Manifesto() {
  return (
    <section className="bg-surface-2">
      <div className="mx-auto max-w-[1180px] px-6 py-28 sm:py-40">
        <div className="mx-auto max-w-[980px] text-center">
          <Reveal>
            <h2 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[72px]">
              Don&apos;t start your migration
              <br className="hidden sm:block" /> with a blank canvas.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-8 max-w-[680px] text-[19px] leading-[1.45] tracking-[-0.012em] text-muted sm:text-[24px]">
              Describe your legacy estate. Migration Atlas maps it, modernizes it, and helps you design what comes next.
            </p>
          </Reveal>
          <div className="mt-16 flex flex-col items-center justify-center gap-1 text-[40px] font-semibold tracking-[-0.045em] sm:flex-row sm:gap-8 sm:text-[64px]">
            <Reveal delay={200}><span className="text-text">Locally.</span></Reveal>
            <Reveal delay={360}><span className="text-text">Visually.</span></Reveal>
            <Reveal delay={520}><span className="text-gradient">Explainably.</span></Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

const JOURNEY = ["Describe", "Generate", "Drag", "Connect", "Validate", "Improve", "Compare", "Plan", "Export"];

export function Journey() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[1180px] px-6 py-24 sm:py-28">
        <Reveal className="text-center">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-accent">The journey</div>
          <h2 className="mt-2 text-[34px] font-semibold tracking-[-0.04em] sm:text-[48px]">Nine steps. One canvas.</h2>
        </Reveal>
        <ol className="mx-auto mt-14 flex max-w-[1040px] flex-wrap justify-center gap-3">
          {JOURNEY.map((step, i) => (
            <Reveal as="li" key={step} delay={i * 70}>
              <div className="group flex items-center gap-2.5 rounded-full border border-border bg-surface py-2.5 pl-2.5 pr-5 shadow-soft transition-all duration-500 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:shadow-lift">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-muted transition-colors duration-500 group-hover:bg-accent group-hover:text-white">{i + 1}</span>
                <span className="text-[15px] font-medium tracking-[-0.015em]">{step}</span>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Side-by-side: a dumb box vs. a domain-aware node. */
export function Understands() {
  return (
    <section className="bg-surface-2">
      <div className="mx-auto grid max-w-[1180px] items-center gap-14 px-6 py-28 sm:py-36 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <h2 className="text-[36px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[52px]">
            Diagram tools understand boxes.
            <span className="text-muted"> Migration Atlas understands what they mean.</span>
          </h2>
          <p className="mt-6 max-w-[480px] text-[17px] leading-[1.5] tracking-[-0.01em] text-muted">
            Every component comes from a migration ontology — category, capabilities, typical targets, risks and the connections
            that make sense. So the canvas can warn you, suggest the next step and explain itself.
          </p>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2">
          <Reveal delay={100} className="flex flex-col rounded-[28px] bg-surface p-6 shadow-soft">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">A box</div>
            <div className="flex flex-1 items-center justify-center py-10">
              <div className="flex h-16 w-36 items-center justify-center rounded-lg border border-dashed border-border-strong text-[14px] text-muted">
                <Box size={15} className="mr-1.5 text-faint" /> Oracle
              </div>
            </div>
            <div className="text-[13px] text-faint">A rectangle with a label. Any arrow goes.</div>
          </Reveal>
          <Reveal delay={220} className="flex flex-col rounded-[28px] bg-surface p-6 shadow-lift">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">A component that knows</div>
            <div className="mt-5 rounded-2xl border border-border bg-surface p-4 shadow-soft" style={{ animation: "float 6s var(--ease-apple) infinite" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgb(225 29 72 / 0.1)", color: "#E11D48" }}>
                  <Database size={18} strokeWidth={1.9} />
                </span>
                <div>
                  <div className="text-[14.5px] font-semibold tracking-[-0.015em]">Oracle</div>
                  <div className="text-[12px] text-faint">Database · OLTP</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {["OLTP", "PL/SQL", "Legacy"].map((t) => (
                  <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">{t}</span>
                ))}
              </div>
              <div className="mt-3 border-t border-border pt-3 text-[12px] text-muted">
                Commonly migrates to
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {["Databricks", "AlloyDB"].map((t) => (
                    <span key={t} className="rounded-full bg-modern-soft px-2 py-0.5 text-[11px] font-medium text-modern">{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 text-[13px] text-muted">Category, capabilities, targets — and which connections are valid.</div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const PERSONAS = [
  { role: "Developer", line: "See exactly what gets rewritten — PL/SQL, mappings, schedules — and what each connection carries.", color: "#0071e3" },
  { role: "Architect", line: "Compose, validate and compare target options with evidence, not opinions.", color: "#a855f7" },
  { role: "Engineering leader", line: "Get a phased roadmap, the risks that matter and a clear trade-off view.", color: "#00a07d" },
];

export function Personas() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[1180px] px-6 py-28">
        <Reveal className="text-center">
          <h2 className="text-[36px] font-semibold tracking-[-0.04em] sm:text-[56px]">One estate. Three lenses.</h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[19px] tracking-[-0.01em] text-muted">The same facts, framed for whoever is asking.</p>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {PERSONAS.map((p, i) => (
            <Reveal key={p.role} delay={i * 120} className="rounded-[28px] bg-surface-2 p-8 transition-all duration-700 ease-[var(--ease-apple)] hover:-translate-y-1 hover:bg-surface hover:shadow-lift">
              <div className="h-1.5 w-10 rounded-full" style={{ background: p.color }} />
              <div className="mt-6 text-[24px] font-semibold tracking-[-0.03em]">{p.role}</div>
              <p className="mt-3 text-[16px] leading-[1.5] tracking-[-0.01em] text-muted">{p.line}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PrivacyBand() {
  const points = [
    { icon: Cpu, label: "Ollama on your machine" },
    { icon: WifiOff, label: "No cloud API keys" },
    { icon: ShieldCheck, label: "Deterministic validator" },
    { icon: Sparkles, label: "AI is optional, never required" },
  ];
  return (
    <section className="bg-surface px-6 pb-28">
      <Reveal className="mx-auto max-w-[1180px] overflow-hidden rounded-[36px] px-8 py-20 text-center sm:px-14"
        >
        <div className="relative">
          <div aria-hidden className="absolute inset-0 -z-10 rounded-[36px]"
            style={{ background: "radial-gradient(60% 80% at 50% 0%, rgb(0 160 125 / 0.10), transparent 70%), linear-gradient(180deg, #f5f5f7, #ffffff)" }} />
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-modern shadow-soft"><Lock size={24} /></div>
          <h2 className="mx-auto max-w-[760px] text-[36px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[56px]">
            Architecture data stays local by default.
          </h2>
          <p className="mx-auto mt-5 max-w-[600px] text-[19px] leading-[1.5] tracking-[-0.01em] text-muted">
            No OpenAI, no cloud API keys — Ollama on your machine. Your estate, diagrams and decisions never leave it unless you export them.
          </p>
          <ul className="mx-auto mt-10 flex max-w-[860px] flex-wrap justify-center gap-3">
            {points.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[14px] font-medium shadow-soft">
                <Icon size={16} className="shrink-0 text-modern" /> {label}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
