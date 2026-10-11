"use client";
// Read-only mini diagram for a pattern template: longest-path layering over data edges,
// cross-cutting components (governance, security, monitoring) parked on a bottom rail.
import { useMemo } from "react";
import { iconFor } from "@/components/ui";
import type { EdgeKind, Pattern, TechCard } from "@/lib/types";

const W = 132, H = 32, COL = 172, ROW = 44, PAD = 14;
const DASHED: EdgeKind[] = ["governance", "security", "monitoring", "control"];

interface Placed { key: string; x: number; y: number; label: string; color: string; icon?: string; legacy: boolean }

function layout(p: Pattern, byId: (id: string) => TechCard | undefined) {
  const nodes = p.template.nodes;
  const edges = p.template.edges.filter((e) => nodes.some((n) => n.key === e.from) && nodes.some((n) => n.key === e.to));
  const isData = (k?: EdgeKind) => !k || k === "data";
  const dataEdges = edges.filter((e) => isData(e.kind));
  const onData = new Set(dataEdges.flatMap((e) => [e.from, e.to]));

  // Longest-path rank; iteration bounded by node count so cycles cannot loop forever.
  const rank = new Map<string, number>(nodes.filter((n) => onData.has(n.key)).map((n) => [n.key, 0]));
  for (let i = 0; i < nodes.length; i++) {
    let changed = false;
    for (const e of dataEdges) {
      const next = (rank.get(e.from) ?? 0) + 1;
      if (next > (rank.get(e.to) ?? 0) && next < nodes.length) { rank.set(e.to, next); changed = true; }
    }
    if (!changed) break;
  }

  const cols = new Map<number, string[]>();
  for (const n of nodes) if (rank.has(n.key)) cols.set(rank.get(n.key)!, [...(cols.get(rank.get(n.key)!) ?? []), n.key]);
  const rail = nodes.filter((n) => !rank.has(n.key)).map((n) => n.key);
  const maxRows = Math.max(1, ...[...cols.values()].map((c) => c.length));
  const nCols = Math.max(1, cols.size ? Math.max(...cols.keys()) + 1 : 0);
  const mainH = maxRows * ROW;

  const meta = (key: string) => {
    const n = nodes.find((x) => x.key === key)!;
    const t = byId(n.tech);
    return { label: n.label || t?.name || n.tech, color: t?.legacy ? "var(--legacy)" : t?.color || "var(--accent)", icon: t?.icon, legacy: !!t?.legacy };
  };
  const placed = new Map<string, Placed>();
  for (const [c, keys] of cols) {
    const offset = (mainH - keys.length * ROW) / 2;
    keys.forEach((k, r) => placed.set(k, { key: k, x: PAD + c * COL, y: PAD + offset + r * ROW, ...meta(k) }));
  }
  const width = Math.max(nCols * COL - (COL - W), rail.length ? Math.min(rail.length, nCols + 1) * (W + 12) : 0) + PAD * 2;
  const perRow = Math.max(1, Math.floor((width - PAD * 2 + 12) / (W + 12)));
  const railTop = PAD + (cols.size ? mainH + 22 : 0);
  rail.forEach((k, i) => placed.set(k, { key: k, x: PAD + (i % perRow) * (W + 12), y: railTop + Math.floor(i / perRow) * ROW, ...meta(k) }));
  const height = (rail.length ? railTop + Math.ceil(rail.length / perRow) * ROW : PAD + mainH) + PAD - (ROW - H);
  return { placed: [...placed.values()], edges, width, height, railTop: rail.length && cols.size ? railTop - 12 : null };
}

function edgePath(a: Placed, b: Placed): string {
  if (b.x > a.x + W / 2) {
    const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, dx = Math.max(24, (x2 - x1) / 2);
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  }
  const down = b.y > a.y;
  const x1 = a.x + W / 2, y1 = down ? a.y + H : a.y, x2 = b.x + W / 2, y2 = down ? b.y : b.y + H, dy = Math.max(18, Math.abs(y2 - y1) / 2) * (down ? 1 : -1);
  return `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
}

export function PatternDiagram({ pattern, byId }: { pattern: Pattern; byId: (id: string) => TechCard | undefined }) {
  const { placed, edges, width, height, railTop } = useMemo(() => layout(pattern, byId), [pattern, byId]);
  const at = (k: string) => placed.find((p) => p.key === k);
  const markerId = `arrow-${pattern.id}`;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-canvas" style={{ backgroundImage: "radial-gradient(var(--dot) 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ minWidth: Math.min(width, 560), maxHeight: 360 }} role="img" aria-label={`${pattern.name} diagram`}>
        <defs>
          <marker id={markerId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--border-strong)" />
          </marker>
        </defs>
        {railTop !== null && <line x1={PAD} x2={width - PAD} y1={railTop} y2={railTop} stroke="var(--border)" strokeDasharray="3 4" />}
        {edges.map((e, i) => {
          const a = at(e.from), b = at(e.to);
          if (!a || !b) return null;
          const dashed = !!e.kind && DASHED.includes(e.kind);
          return <path key={i} d={edgePath(a, b)} fill="none" stroke={dashed ? "var(--faint)" : "var(--border-strong)"} strokeWidth={1.4}
            strokeDasharray={dashed ? "4 4" : undefined} opacity={dashed ? 0.7 : 1} markerEnd={`url(#${markerId})`}><title>{e.label || e.kind || "data"}</title></path>;
        })}
        {placed.map((n) => {
          const Icon = iconFor(n.icon);
          const label = n.label.length > 19 ? `${n.label.slice(0, 18)}…` : n.label;
          return (
            <g key={n.key}>
              <title>{n.label}</title>
              <rect x={n.x} y={n.y} width={W} height={H} rx={9} fill="var(--surface)" stroke="var(--border)" />
              <rect x={n.x + 5} y={n.y + 5} width={22} height={22} rx={6} fill={n.color} opacity={0.14} />
              <Icon x={n.x + 9} y={n.y + 9} size={14} color={n.color} strokeWidth={2} />
              <text x={n.x + 33} y={n.y + H / 2 + 3.5} fontSize={10.5} fontWeight={500} fill="var(--text)" fontFamily="var(--font-sans)">{label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
