"use client";
// Floating edge: attaches to whichever side of each node faces the other, so cross-cutting
// components below the data flow connect cleanly from their top edge.
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, useInternalNode, type EdgeProps, type InternalNode } from "@xyflow/react";
import { memo } from "react";
import type { ArchFlowEdge } from "@/lib/studio-store";
import { STATUS_META } from "@/lib/utils";

const KIND_STYLE: Record<string, { color: string; dash?: string }> = {
  data: { color: "var(--border-strong)" },
  control: { color: "var(--faint)", dash: "6 5" },
  governance: { color: "var(--ok)", dash: "2 5" },
  security: { color: "var(--bad)", dash: "2 5" },
  monitoring: { color: "#ec4899", dash: "2 5" },
};

function center(n: InternalNode) {
  const w = n.measured.width || 236;
  const h = n.measured.height || 76;
  return { x: n.internals.positionAbsolute.x + w / 2, y: n.internals.positionAbsolute.y + h / 2, w, h };
}

function sidePoint(n: InternalNode, other: InternalNode): { x: number; y: number; pos: Position } {
  const a = center(n);
  const b = center(other);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Prefer horizontal attachment unless the other node is clearly above/below.
  if (Math.abs(dy) > Math.abs(dx) * 0.55 && Math.abs(dy) > a.h) {
    return dy > 0 ? { x: a.x, y: a.y + a.h / 2, pos: Position.Bottom } : { x: a.x, y: a.y - a.h / 2, pos: Position.Top };
  }
  return dx > 0 ? { x: a.x + a.w / 2, y: a.y, pos: Position.Right } : { x: a.x - a.w / 2, y: a.y, pos: Position.Left };
}

function SmartEdgeImpl({ id, source, target, data, selected, markerEnd }: EdgeProps<ArchFlowEdge>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const sp = sidePoint(s, t);
  const tp = sidePoint(t, s);
  const [path, lx, ly] = getBezierPath({ sourceX: sp.x, sourceY: sp.y, sourcePosition: sp.pos, targetX: tp.x, targetY: tp.y, targetPosition: tp.pos, curvature: 0.3 });
  const arch = data.arch;
  const status = arch.status || data.assessment?.status;
  const kind = KIND_STYLE[arch.kind] || KIND_STYLE.data;
  const problem = status && status !== "VALID" && status !== "UNKNOWN";
  const stroke = problem ? STATUS_META[status].color : arch.kind === "data" ? (selected ? "var(--accent)" : "color-mix(in srgb, var(--accent) 55%, var(--border-strong))") : kind.color;
  const flowing = arch.kind === "data" && (arch.mode === "cdc" || arch.mode === "streaming");
  const label = arch.label || (arch.kind === "data" && arch.mode && arch.mode !== "batch" ? arch.mode.toUpperCase() : null);
  return (
    <>
      <g style={{ opacity: 1, animation: data.delay ? `fade 0.6s ease ${data.delay}ms both` : undefined }}>
        <BaseEdge id={id} path={path} markerEnd={markerEnd}
          style={{ stroke, strokeWidth: selected ? 2.6 : arch.kind === "data" ? 1.8 : 1.4, strokeDasharray: status === "INVALID" ? "5 4" : kind.dash }} />
        {flowing && <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} className="edge-flow" opacity={0.55} style={{ pointerEvents: "none" }} />}
        <path d={path} fill="none" stroke="transparent" strokeWidth={16} />
      </g>
      {(label || problem) && (
        <EdgeLabelRenderer>
          <div className="nodrag nopan pointer-events-auto absolute flex items-center gap-1 rounded-full border bg-surface px-2 py-[1px] text-[10px] font-medium text-muted shadow-soft"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, borderColor: problem ? STATUS_META[status!].color : "var(--border)",
              animation: data.delay ? `fade 0.5s ease ${data.delay + 300}ms both` : undefined }}>
            {problem && <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[status!].color }} />}
            {label || STATUS_META[status!].label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SmartEdge = memo(SmartEdgeImpl);
