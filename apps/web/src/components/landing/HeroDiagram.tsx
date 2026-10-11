"use client";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { iconFor } from "@/components/ui";
import { cn } from "@/lib/utils";

/* A miniature canvas that "modernizes" a legacy estate node by node, then settles with data flowing. */

type Face = { name: string; sub: string; icon: string };
type DiagramNode = { layer: string; legacy: Face; modern: Face & { color: string } };

const NODES: DiagramNode[] = [
  { layer: "Source", legacy: { name: "Oracle 11g", sub: "On-prem · OLTP", icon: "database" },
    modern: { name: "Oracle", sub: "Source · OLTP", icon: "database", color: "#E11D48" } },
  { layer: "Ingest", legacy: { name: "Legacy ETL", sub: "Nightly batch", icon: "workflow" },
    modern: { name: "CDC", sub: "Datastream", icon: "git-compare", color: "#14B8A6" } },
  { layer: "Land", legacy: { name: "File share", sub: "NFS staging", icon: "hard-drive" },
    modern: { name: "Cloud Storage", sub: "Landing · Bronze", icon: "cloud", color: "#3B82F6" } },
  { layer: "Process", legacy: { name: "Teradata", sub: "EDW appliance", icon: "warehouse" },
    modern: { name: "Databricks", sub: "Lakehouse · Delta", icon: "sparkles", color: "#FF3621" } },
  { layer: "Serve", legacy: { name: "Reports", sub: "Scheduled PDFs", icon: "file-text" },
    modern: { name: "BI", sub: "Looker · Tableau", icon: "chart-column", color: "#A855F7" } },
];

type Rect = { x: number; y: number; w: number; h: number };
type Layout = { w: number; h: number; nw: number; nh: number; dir: "h" | "v"; centers: { x: number; y: number }[]; onprem: Rect; cloud: Rect };

const H: Layout = {
  w: 1000, h: 300, nw: 150, nh: 76, dir: "h",
  centers: [{ x: 100, y: 128 }, { x: 300, y: 184 }, { x: 500, y: 128 }, { x: 700, y: 184 }, { x: 900, y: 128 }],
  onprem: { x: 12, y: 52, w: 976, h: 212 }, cloud: { x: 210, y: 52, w: 778, h: 212 },
};
const V: Layout = {
  w: 360, h: 640, nw: 172, nh: 72, dir: "v",
  centers: [{ x: 136, y: 82 }, { x: 224, y: 202 }, { x: 136, y: 322 }, { x: 224, y: 442 }, { x: 136, y: 562 }],
  onprem: { x: 14, y: 30, w: 332, h: 596 }, cloud: { x: 14, y: 150, w: 332, h: 476 },
};

const FINAL = NODES.length + 1; // every node modern + validated

function edgePath(l: Layout, i: number) {
  const a = l.centers[i], b = l.centers[i + 1];
  if (l.dir === "h") {
    const x1 = a.x + l.nw / 2, x2 = b.x - l.nw / 2, mx = (x1 + x2) / 2;
    return `M ${x1} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y}`;
  }
  const y1 = a.y + l.nh / 2, y2 = b.y - l.nh / 2, my = (y1 + y2) / 2;
  return `M ${a.x} ${y1} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${y2}`;
}

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

function NodeCard({ node, l, i, modern, showLayer }: { node: DiagramNode; l: Layout; i: number; modern: boolean; showLayer: boolean }) {
  const c = l.centers[i];
  const x = c.x - l.nw / 2, y = c.y - l.nh / 2;
  const face = modern ? node.modern : node.legacy;
  const color = modern ? node.modern.color : "var(--legacy)";
  const Icon = iconFor(face.icon);
  const anim = { transformBox: "fill-box" as const, transformOrigin: "center" };
  return (
    <g>
      {showLayer && (
        <text x={c.x} y={y - 11} textAnchor="middle" fontSize={9.5} fontWeight={600} letterSpacing="0.09em"
          style={{ fill: modern ? "var(--muted)" : "var(--faint)", transition: "fill .4s" }}>{node.layer.toUpperCase()}</text>
      )}
      <g key={modern ? "m" : "l"} style={modern ? { ...anim, animation: "pop .55s cubic-bezier(.2,.9,.3,1.2) both" } : { ...anim, animation: "fade .4s ease both" }}>
        {modern && (
          <rect x={x} y={y} width={l.nw} height={l.nh} rx={15} fill="none" strokeWidth={2}
            style={{ ...anim, stroke: color, animation: "ma-ring 1.1s ease-out both" }} />
        )}
        <rect x={x} y={y} width={l.nw} height={l.nh} rx={15} filter={modern ? "url(#ma-shadow)" : undefined}
          strokeDasharray={modern ? undefined : "4 3"}
          style={{ fill: modern ? "var(--surface)" : "var(--surface-2)", stroke: modern ? `color-mix(in srgb, ${color} 40%, var(--border))` : "var(--border-strong)" }} />
        <rect x={x + 12} y={c.y - 16} width={32} height={32} rx={9}
          style={{ fill: `color-mix(in srgb, ${color} 14%, transparent)`, stroke: `color-mix(in srgb, ${color} 24%, transparent)` }} />
        <Icon x={x + 20} y={c.y - 8} width={16} height={16} strokeWidth={1.9} style={{ color }} />
        <text x={x + 54} y={c.y - 2} fontSize={13} fontWeight={600} style={{ fill: modern ? "var(--text)" : "var(--muted)", letterSpacing: "-0.01em" }}>{face.name}</text>
        <text x={x + 54} y={c.y + 14} fontSize={10.5} style={{ fill: "var(--faint)" }}>{face.sub}</text>
      </g>
    </g>
  );
}

function Boundary({ r, label, visible, dashed, color }: { r: Rect; label: string; visible: boolean; dashed?: boolean; color: string }) {
  return (
    <g style={{ opacity: visible ? 1 : 0, transition: "opacity .7s ease" }}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={20} fill="none" strokeWidth={1.2} strokeDasharray={dashed ? "5 5" : undefined}
        style={{ stroke: `color-mix(in srgb, ${color} 45%, transparent)`, fill: `color-mix(in srgb, ${color} 3%, transparent)` }} />
      <text x={r.x + 16} y={r.y + r.h - 14} fontSize={10} fontWeight={600} letterSpacing="0.08em" style={{ fill: color }}>{label.toUpperCase()}</text>
    </g>
  );
}

export function HeroDiagram() {
  const narrow = useMedia("(max-width: 767px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);
  const l = narrow ? V : H;

  useEffect(() => {
    if (reduced) { setStep(FINAL); setFading(false); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      setFading(false);
      setStep(0);
      for (let s = 1; s <= FINAL; s++) timers.push(setTimeout(() => setStep(s), 1300 + (s - 1) * 750));
      timers.push(setTimeout(() => setFading(true), 9500));
      timers.push(setTimeout(cycle, 10000));
    };
    cycle();
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  const done = step >= FINAL;
  const status = step === 0 ? { label: "Current estate", color: "var(--legacy)" }
    : done ? { label: "Target architecture", color: "var(--modern)" }
    : { label: `Modernizing · ${step}/${NODES.length}`, color: "var(--accent)" };

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-border bg-surface shadow-lift">
      <style>{`@keyframes ma-ring { 0% { opacity: .7; transform: scale(1); } 100% { opacity: 0; transform: scale(1.14); } }`}</style>
      {/* window chrome */}
      <div className="flex h-10 items-center gap-3 border-b border-border px-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-surface-3" />)}
        </div>
        <span className="hidden font-mono text-[11px] text-faint sm:inline">retail-modernization.atlas</span>
        <span className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-muted sm:mx-0 sm:ml-auto">
          <span className="h-1.5 w-1.5 rounded-full transition-colors" style={{ background: status.color }} />
          {status.label}
        </span>
        <span className="hidden text-[11px] text-faint md:inline">Oracle → GCP + Databricks</span>
      </div>

      {/* canvas */}
      <div className="relative bg-canvas" style={{ backgroundImage: "radial-gradient(var(--dot) 1px, transparent 1.3px)", backgroundSize: "20px 20px" }}>
        <svg viewBox={`0 0 ${l.w} ${l.h}`} className={cn("mx-auto block w-full transition-opacity duration-500", narrow && "max-w-[420px]", fading && "opacity-0")}
          role="img" aria-label="Animated diagram: an on-prem Oracle, ETL, file share, Teradata and reports estate modernizes into Oracle, CDC, Cloud Storage, Databricks and BI on Google Cloud.">
          <defs>
            <filter id="ma-shadow" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.09" />
            </filter>
          </defs>

          <Boundary r={l.onprem} label="On-prem data center" visible={step === 0} dashed color="var(--legacy)" />
          <Boundary r={l.cloud} label="Google Cloud" visible={done} color="var(--modern)" />

          {NODES.slice(0, -1).map((_, i) => {
            const d = edgePath(l, i);
            const active = step >= i + 2;
            const color = NODES[i + 1].modern.color;
            return (
              <g key={`e${i}-${l.dir}`}>
                <path d={d} fill="none" strokeWidth={1.5} strokeDasharray="4 5"
                  style={{ stroke: "var(--border-strong)", opacity: active ? 0 : 1, transition: "opacity .5s" }} />
                <path d={d} fill="none" strokeWidth={2} strokeLinecap="round" pathLength={1}
                  style={{ stroke: `color-mix(in srgb, ${color} 70%, var(--accent))`, strokeDasharray: 1, strokeDashoffset: active ? 0 : 1,
                    transition: "stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)" }} />
                {active && !reduced && [0, 1].map((k) => (
                  <g key={k}>
                    <circle r={6} style={{ fill: color, opacity: 0.18 }}>
                      <animateMotion dur="2.2s" begin={`${0.6 + k * 1.1}s`} repeatCount="indefinite" path={d} />
                    </circle>
                    <circle r={3} style={{ fill: color }}>
                      <animateMotion dur="2.2s" begin={`${0.6 + k * 1.1}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  </g>
                ))}
              </g>
            );
          })}

          {NODES.map((n, i) => (
            <NodeCard key={`${n.layer}-${l.dir}`} node={n} l={l} i={i} modern={step >= i + 1} showLayer={l.dir === "h"} />
          ))}
        </svg>

        {done && (
          <div className={cn("absolute bottom-3 right-3 inline-flex animate-pop items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11.5px] font-medium shadow-soft transition-opacity duration-500", fading && "opacity-0")}>
            <ShieldCheck size={13} className="text-ok" />
            <span className="text-text">Validated</span>
            <span className="text-faint">·</span>
            <span className="text-ok">0 critical</span>
          </div>
        )}
      </div>
    </div>
  );
}
