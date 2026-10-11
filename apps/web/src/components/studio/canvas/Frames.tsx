"use client";
// Swimlanes and group frames are drawn in flow coordinates beneath the nodes.
import { ViewportPortal } from "@xyflow/react";
import { useMemo } from "react";
import { computeLanes, NODE_H, NODE_W } from "@/lib/layout";
import { useStudio } from "@/lib/studio-store";
import { LAYER_NAMES } from "@/lib/utils";

const NO_GROUPS: never[] = [];
const LANE_TINT: Record<string, string> = {
  sources: "var(--legacy)", ingestion: "#14B8A6", storage: "#3B82F6", processing: "#F59E0B", serving: "#6366F1",
  consumption: "#A855F7", governance: "#059669", security: "#DC2626", operations: "#EC4899",
};

export function Frames() {
  const nodes = useStudio((s) => s.nodes);
  const swimlanes = useStudio((s) => s.swimlanes);
  const groups = useStudio((s) => s.project?.options.find((o) => o.id === s.activeId)?.groups) || NO_GROUPS;
  const lanes = useMemo(() => (swimlanes ? computeLanes(nodes.map((n) => ({
    id: n.id, layer: n.data.arch.layer || n.data.tech?.layer || "processing", x: n.position.x, y: n.position.y,
  }))) : []), [nodes, swimlanes]);
  const frames = useMemo(() => groups.map((g) => {
    const members = nodes.filter((n) => g.node_ids.includes(n.id));
    if (!members.length) return null;
    const x0 = Math.min(...members.map((n) => n.position.x)) - 18;
    const y0 = Math.min(...members.map((n) => n.position.y)) - 34;
    const x1 = Math.max(...members.map((n) => n.position.x + NODE_W)) + 18;
    const y1 = Math.max(...members.map((n) => n.position.y + NODE_H)) + 18;
    return { ...g, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }).filter(Boolean) as { id: string; label: string; x: number; y: number; w: number; h: number }[], [groups, nodes]);

  return (
    <ViewportPortal>
      <div style={{ position: "absolute", left: 0, top: 0, zIndex: -1, pointerEvents: "none" }}>
        {lanes.map((l) => {
          const tint = LANE_TINT[l.label] || "var(--faint)";
          return (
            <div key={l.id} className="absolute rounded-[18px] animate-fade"
              style={{ left: l.x, top: l.y, width: l.width, height: l.height,
                background: `color-mix(in srgb, ${tint} 5%, transparent)`, border: `1px solid color-mix(in srgb, ${tint} 16%, transparent)` }}>
              <div className="absolute left-3 top-2 text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: `color-mix(in srgb, ${tint} 75%, var(--text))` }}>
                {LAYER_NAMES[l.label] || l.label}
              </div>
            </div>
          );
        })}
        {frames.map((f) => (
          <div key={f.id} className="absolute rounded-[18px] border-2 border-dashed animate-fade"
            style={{ left: f.x, top: f.y, width: f.w, height: f.h, borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
              background: "color-mix(in srgb, var(--accent) 3%, transparent)" }}>
            <div className="absolute left-3 top-1.5 text-[11px] font-semibold text-accent">{f.label}</div>
          </div>
        ))}
      </div>
    </ViewportPortal>
  );
}
