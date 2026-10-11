import { Box, Cpu, Database, Lock, ShieldCheck, Sparkles, WifiOff } from "lucide-react";

/** Typographic statement: why Migration Atlas exists. */
export function Manifesto() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-[900px] text-center">
        <h2 className="font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[52px]">
          Don&apos;t start your migration
          <br className="hidden sm:block" /> with a blank canvas.
        </h2>
        <p className="mx-auto mt-6 max-w-[640px] text-[16px] leading-relaxed text-muted sm:text-[18px]">
          Describe your legacy estate. Migration Atlas maps it, modernizes it, and helps you design what comes next.
        </p>
        <div className="mt-12 flex flex-col items-center justify-center gap-1 font-[family-name:var(--font-display)] text-[30px] font-semibold tracking-[-0.03em] sm:flex-row sm:gap-5 sm:text-[44px]">
          <span className="text-text">Locally.</span>
          <span className="text-muted">Visually.</span>
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, var(--accent), var(--modern))" }}>Explainably.</span>
        </div>
      </div>
    </section>
  );
}

const JOURNEY = ["Describe", "Generate", "Drag", "Connect", "Validate", "Improve", "Compare", "Plan", "Export"];

export function Journey() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-24">
      <div className="mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">The journey</div>
      <ol className="mx-auto grid max-w-[1040px] grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-9">
        {JOURNEY.map((step, i) => (
          <li key={step} className="group flex flex-col items-center gap-1.5 bg-surface px-2 py-5 transition-colors hover:bg-surface-2">
            <span className="font-mono text-[10.5px] text-faint transition-colors group-hover:text-accent">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-[13px] font-medium tracking-[-0.01em]">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Side-by-side: a dumb box vs. a domain-aware node. */
export function Understands() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 py-24 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[40px]">
            Traditional diagramming tools understand boxes.
            <span className="text-muted"> Migration Atlas understands what the boxes mean.</span>
          </h2>
          <p className="mt-5 max-w-[460px] text-[15px] leading-relaxed text-muted">
            Every component comes from a migration ontology — category, capabilities, typical targets, risks and the connections that make sense.
            So the canvas can warn you, suggest the next step and explain itself.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-dashed border-border-strong bg-bg p-5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">A box</div>
            <div className="flex flex-1 items-center justify-center py-8">
              <div className="flex h-16 w-36 items-center justify-center rounded-md border border-border-strong bg-surface text-[13px] text-muted">
                <Box size={14} className="mr-1.5 text-faint" /> Oracle
              </div>
            </div>
            <div className="text-[12px] text-faint">A rectangle with a label. Any arrow goes.</div>
          </div>
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent">A component that knows</div>
            <div className="mt-4 rounded-xl border border-border bg-surface p-3.5 shadow-soft">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: "color-mix(in srgb, #E11D48 13%, transparent)", color: "#E11D48" }}>
                  <Database size={17} strokeWidth={1.9} />
                </span>
                <div>
                  <div className="text-[13.5px] font-semibold tracking-[-0.01em]">Oracle</div>
                  <div className="text-[11.5px] text-faint">Database · OLTP</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {["OLTP", "PL/SQL", "Legacy"].map((t) => (
                  <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-muted">{t}</span>
                ))}
              </div>
              <div className="mt-3 border-t border-border pt-2.5 text-[11.5px] text-muted">
                Commonly migrates to
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {["Databricks", "AlloyDB"].map((t) => (
                    <span key={t} className="rounded-md bg-modern-soft px-1.5 py-0.5 text-[10.5px] font-medium text-modern">{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 text-[12px] text-muted">Category, capabilities, targets — and which connections are valid.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

const PERSONAS = [
  { role: "Developer", line: "See exactly what gets rewritten — PL/SQL, mappings, schedules — and what each connection carries." },
  { role: "Architect", line: "Compose, validate and compare target options with evidence, not opinions." },
  { role: "Engineering leader", line: "Get a phased roadmap, the risks that matter and a clear trade-off view." },
];

export function Personas() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-24">
      <h2 className="text-center font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-[-0.03em] sm:text-[36px]">One estate. Three lenses.</h2>
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
        {PERSONAS.map((p, i) => (
          <div key={p.role} className="bg-surface p-7">
            <div className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-3 text-[17px] font-semibold tracking-[-0.015em]">{p.role}</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{p.line}</p>
          </div>
        ))}
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
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-[1180px] overflow-hidden rounded-[28px] border border-border bg-surface px-8 py-14 shadow-soft sm:px-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-modern-soft text-modern"><Lock size={18} /></div>
            <h2 className="font-[family-name:var(--font-display)] text-[28px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[36px]">
              Architecture data stays local by default.
            </h2>
            <p className="mt-4 max-w-[520px] text-[15px] leading-relaxed text-muted">
              No OpenAI, no cloud API keys — Ollama on your machine. Your estate, diagrams and decisions never leave it unless you export them.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {points.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] font-medium">
                <Icon size={15} className="shrink-0 text-modern" /> {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
