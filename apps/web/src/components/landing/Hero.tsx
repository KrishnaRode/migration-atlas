"use client";
import { ArrowRight, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { ErrorNote } from "@/components/ui";
import { HeroDiagram } from "./HeroDiagram";
import { useOpenSample } from "./useOpenSample";

export const FEATURED_SAMPLE = "retail-oracle-gcp-databricks";

export function Hero() {
  const { open, pending, error } = useOpenSample();
  return (
    <section className="relative overflow-hidden bg-surface">
      {/* A soft daylight wash behind the headline. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[760px]"
        style={{ background: "radial-gradient(50% 45% at 50% 18%, rgb(0 113 227 / 0.07), transparent 70%), radial-gradient(35% 35% at 78% 40%, rgb(0 160 125 / 0.06), transparent 70%), radial-gradient(30% 30% at 22% 46%, rgb(168 85 247 / 0.05), transparent 70%)" }} />
      <div className="relative mx-auto max-w-[1180px] px-6 pb-24 pt-20 sm:pt-28">
        <div className="mx-auto max-w-[900px] text-center">
          <div className="animate-rise text-[17px] font-semibold tracking-[-0.01em] text-modern sm:text-[19px]">
            New · The Sunday Builds #14
          </div>
          <h1 className="mt-3 animate-rise text-[56px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[96px]"
            style={{ animationDelay: "80ms" }}>
            Migration Atlas
          </h1>
          <p className="mt-4 animate-rise text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[40px]" style={{ animationDelay: "160ms" }}>
            Your legacy estate in.<br className="sm:hidden" />{" "}
            <span className="text-gradient">Your future architecture out.</span>
          </p>
          <p className="mx-auto mt-6 max-w-[620px] animate-rise text-[17px] leading-[1.5] tracking-[-0.01em] text-muted sm:text-[21px]" style={{ animationDelay: "240ms" }}>
            Explore, design, compare and validate legacy-to-cloud modernization architectures using local AI.
          </p>
          <div className="mt-10 flex animate-rise flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6" style={{ animationDelay: "320ms" }}>
            <Link href="/projects/new"
              className="group inline-flex h-[52px] items-center gap-2 rounded-full bg-accent px-8 text-[17px] font-medium tracking-[-0.01em] text-white shadow-[0_8px_24px_-8px_rgb(0_113_227/0.55)] transition-all duration-500 ease-[var(--ease-apple)] hover:bg-accent-strong hover:shadow-[0_12px_32px_-8px_rgb(0_113_227/0.6)] active:scale-[0.97]">
              Start New Migration
              <ArrowRight size={18} className="transition-transform duration-500 ease-[var(--ease-apple)] group-hover:translate-x-0.5" />
            </Link>
            <button onClick={() => open(FEATURED_SAMPLE)} disabled={pending === FEATURED_SAMPLE}
              className="group inline-flex items-center gap-1 text-[17px] font-medium tracking-[-0.01em] text-accent transition-opacity hover:underline disabled:opacity-60">
              {pending === FEATURED_SAMPLE ? <><Loader2 size={16} className="animate-spin" /> Opening sample…</> : <>Explore Sample Estate <ChevronRight size={18} className="transition-transform duration-500 ease-[var(--ease-apple)] group-hover:translate-x-0.5" /></>}
            </button>
          </div>
          {error && <div className="mx-auto mt-5 max-w-[520px] animate-fade text-left"><ErrorNote message={error} onRetry={() => open(FEATURED_SAMPLE)} /></div>}
        </div>

        <div className="mx-auto mt-16 max-w-[1080px] animate-rise sm:mt-20" style={{ animationDelay: "440ms" }}>
          <div className="rounded-[28px] bg-gradient-to-b from-white to-surface-2 p-2 shadow-[0_2px_4px_rgb(0_0_0/0.03),0_30px_80px_-20px_rgb(0_0_0/0.18)] ring-1 ring-black/[0.04]">
            <HeroDiagram />
          </div>
          <p className="mt-5 text-center text-[13px] text-faint">
            A retail estate on Oracle and nightly batch, re-imagined on Google Cloud and Databricks — then checked by a deterministic validator.
          </p>
        </div>
      </div>
    </section>
  );
}
