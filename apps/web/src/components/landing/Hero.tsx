"use client";
import { ArrowRight, Compass, Loader2 } from "lucide-react";
import { ErrorNote, LinkButton } from "@/components/ui";
import { HeroDiagram } from "./HeroDiagram";
import { useOpenSample } from "./useOpenSample";

export const FEATURED_SAMPLE = "retail-oracle-gcp-databricks";

export function Hero() {
  const { open, pending, error } = useOpenSample();
  return (
    <section className="relative overflow-hidden">
      {/* soft wash behind the headline — the only gradient on the page */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 h-[620px]"
        style={{ background: "radial-gradient(60% 50% at 50% 30%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%), radial-gradient(40% 40% at 72% 42%, color-mix(in srgb, var(--modern) 9%, transparent), transparent 70%)" }} />
      <div className="relative mx-auto max-w-[1180px] px-6 pb-20 pt-16 sm:pt-24">
        <div className="mx-auto max-w-[820px] text-center">
          <div className="inline-flex animate-rise items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-[12px] font-medium text-muted backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-modern" />
            The Sunday Builds #14 · Local AI
          </div>
          <h1 className="mt-6 animate-rise font-[family-name:var(--font-display)] text-[48px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[72px]"
            style={{ animationDelay: "60ms" }}>
            Migration Atlas
          </h1>
          <p className="mt-5 animate-rise text-[22px] font-medium leading-snug tracking-[-0.015em] text-text sm:text-[28px]" style={{ animationDelay: "120ms" }}>
            Your legacy estate in.{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, var(--accent), var(--modern))" }}>
              Your future architecture out.
            </span>
          </p>
          <p className="mx-auto mt-4 max-w-[560px] animate-rise text-[15px] leading-relaxed text-muted sm:text-[16px]" style={{ animationDelay: "180ms" }}>
            Explore, design, compare and validate legacy-to-cloud modernization architectures using local AI.
          </p>
          <div className="mt-8 flex animate-rise flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "240ms" }}>
            <LinkButton href="/projects/new" variant="primary" size="lg" className="w-full sm:w-auto">
              Start New Migration <ArrowRight size={16} />
            </LinkButton>
            <button onClick={() => open(FEATURED_SAMPLE)} disabled={pending === FEATURED_SAMPLE}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 text-[15px] font-medium text-text transition-all duration-150 hover:border-border-strong hover:bg-surface-2 active:scale-[0.98] disabled:opacity-70 sm:w-auto">
              {pending === FEATURED_SAMPLE ? <Loader2 size={16} className="animate-spin" /> : <Compass size={16} />}
              {pending === FEATURED_SAMPLE ? "Opening sample…" : "Explore Sample Estate"}
            </button>
          </div>
          {error && <div className="mx-auto mt-4 max-w-[520px] text-left animate-fade"><ErrorNote message={error} onRetry={() => open(FEATURED_SAMPLE)} /></div>}
        </div>

        <div className="mx-auto mt-14 max-w-[1080px] animate-rise sm:mt-16" style={{ animationDelay: "320ms" }}>
          <HeroDiagram />
          <p className="mt-4 text-center text-[12px] text-faint">
            A retail estate on Oracle and nightly batch, re-imagined on Google Cloud and Databricks — then checked by a deterministic validator.
          </p>
        </div>
      </div>
    </section>
  );
}
