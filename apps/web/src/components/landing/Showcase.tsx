"use client";
// Product shot that grows into place as it scrolls into view — the apple.com "hero product" move.
import { Reveal, useScrollProgress } from "@/components/reveal";

export function Showcase() {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();
  const p = Math.min(1, progress * 1.6);
  const scale = 0.86 + 0.14 * p;
  const tilt = 14 * (1 - p);
  return (
    <section className="overflow-hidden bg-surface pb-28 pt-24 sm:pt-32">
      <div className="mx-auto max-w-[1180px] px-6">
        <Reveal className="mx-auto max-w-[760px] text-center">
          <h2 className="text-[40px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[64px]">The studio.</h2>
          <p className="mt-4 text-[19px] leading-[1.45] tracking-[-0.01em] text-muted sm:text-[22px]">
            A canvas that knows Oracle is a database, Informatica is ETL and Control-M schedules — and reasons about how they modernize.
          </p>
        </Reveal>
        <div ref={ref} className="mx-auto mt-14 max-w-[1100px]" style={{ perspective: "1600px" }}>
          <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_2px_6px_rgb(0_0_0/0.04),0_40px_100px_-30px_rgb(0_0_0/0.28)] ring-1 ring-black/[0.06] will-change-transform"
            style={{ transform: `scale(${scale}) rotateX(${tilt}deg)`, transformOrigin: "50% 0%", transition: "transform 80ms linear" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/showcase-studio.png" alt="Migration Atlas studio: component library, domain-aware canvas and AI copilot" className="block w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
