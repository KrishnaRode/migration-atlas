// Auto-layout. The model never produces coordinates; this does.
// Data-flow components are laid out left→right with ELK, partitioned by architecture layer so
// sources always sit left of ingestion, storage, processing, serving and consumption.
// Cross-cutting components (governance, security, operations) form rows beneath, each placed
// under the components it connects to.
import ELK from "elkjs/lib/elk.bundled.js";
import type { Architecture, Position, TechCard } from "./types";
import { CROSS_LAYERS, DATA_LAYERS } from "./utils";

export const NODE_W = 236;
export const NODE_H = 76;
const elk = new ELK();

export function nodeLayer(layer: string | null | undefined, tech?: TechCard): string {
  return layer || tech?.layer || "processing";
}

export async function layoutArchitecture(arch: Architecture, techIndex: Record<string, TechCard>): Promise<Record<string, Position>> {
  const positions: Record<string, Position> = {};
  const dataNodes = arch.nodes.filter((n) => DATA_LAYERS.includes(nodeLayer(n.layer, techIndex[n.tech_id])));
  const crossNodes = arch.nodes.filter((n) => !dataNodes.includes(n));
  const dataIds = new Set(dataNodes.map((n) => n.id));

  // Lake zones (landing → bronze → silver → gold, raw → staging → curated) are stacked as one
  // vertical column so a medallion chain reads top-down instead of stretching the diagram sideways.
  const ZONE_GAP = 26;
  const zones = dataNodes.filter((n) => techIndex[n.tech_id]?.role === "lake-layer");
  const zoneOrder = ["landing", "raw", "bronze", "staging", "silver", "curated", "gold"];
  zones.sort((a, b) => zoneOrder.indexOf(techIndex[a.tech_id]?.stage || "") - zoneOrder.indexOf(techIndex[b.tech_id]?.stage || ""));
  const zoneIds = new Set(zones.map((z) => z.id));
  const ZONE_BOX = "__zones__";
  const ref = (id: string) => (zoneIds.size > 1 && zoneIds.has(id) ? ZONE_BOX : id);
  const elkNodes = dataNodes.filter((n) => zoneIds.size <= 1 || !zoneIds.has(n.id));

  if (dataNodes.length) {
    const children = elkNodes.map((n) => ({
      id: n.id, width: NODE_W, height: NODE_H,
      layoutOptions: { "elk.partitioning.partition": String(DATA_LAYERS.indexOf(nodeLayer(n.layer, techIndex[n.tech_id]))) },
    }));
    if (zoneIds.size > 1) {
      children.push({ id: ZONE_BOX, width: NODE_W, height: zones.length * NODE_H + (zones.length - 1) * ZONE_GAP,
        layoutOptions: { "elk.partitioning.partition": String(DATA_LAYERS.indexOf("storage")) } });
    }
    const seen = new Set<string>();
    const elkEdges = arch.edges
      .filter((e) => e.kind === "data" && dataIds.has(e.source) && dataIds.has(e.target))
      .map((e) => ({ id: e.id, s: ref(e.source), t: ref(e.target) }))
      .filter((e) => e.s !== e.t && !seen.has(`${e.s}>${e.t}`) && seen.add(`${e.s}>${e.t}`))
      .map((e) => ({ id: e.id, sources: [e.s], targets: [e.t] }));
    const graph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.partitioning.activate": "true",
        "elk.layered.spacing.nodeNodeBetweenLayers": "96",
        "elk.spacing.nodeNode": "44",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.edgeRouting": "SPLINES",
      },
      children,
      edges: elkEdges,
    };
    try {
      const out = await elk.layout(graph);
      for (const c of out.children || []) {
        if (c.id === ZONE_BOX) {
          zones.forEach((z, i) => { positions[z.id] = { x: c.x || 0, y: (c.y || 0) + i * (NODE_H + ZONE_GAP) }; });
        } else positions[c.id] = { x: c.x || 0, y: c.y || 0 };
      }
    } catch {
      // Fallback: simple columns per layer.
      const cols: Record<string, number> = {};
      for (const n of dataNodes) {
        const li = DATA_LAYERS.indexOf(nodeLayer(n.layer, techIndex[n.tech_id]));
        cols[li] = (cols[li] || 0) + 1;
        positions[n.id] = { x: li * (NODE_W + 110), y: (cols[li] - 1) * (NODE_H + 46) };
      }
    }
  }

  // ELK ignores partitions for nodes without data edges (e.g. the platform node that only "runs"
  // pipelines), dropping them in the first column. Put each one under its own layer's column.
  const connected = new Set(arch.edges.filter((e) => e.kind === "data").flatMap((e) => [e.source, e.target]));
  const colX: Record<number, number[]> = {};
  for (const n of dataNodes) {
    if (!connected.has(n.id) || !positions[n.id]) continue;
    const li = DATA_LAYERS.indexOf(nodeLayer(n.layer, techIndex[n.tech_id]));
    (colX[li] ||= []).push(positions[n.id].x);
  }
  for (const n of dataNodes) {
    if (connected.has(n.id)) continue;
    const li = DATA_LAYERS.indexOf(nodeLayer(n.layer, techIndex[n.tech_id]));
    let x = colX[li]?.length ? Math.min(...colX[li]) : NaN;
    if (Number.isNaN(x)) {
      const before = Object.entries(colX).filter(([k]) => Number(k) < li).flatMap(([, v]) => v);
      x = before.length ? Math.max(...before) + NODE_W + 96 : 0;
    }
    const sameCol = Object.entries(positions).filter(([id, p]) => id !== n.id && Math.abs(p.x - x) < NODE_W / 2).map(([, p]) => p.y);
    positions[n.id] = { x, y: sameCol.length ? Math.max(...sameCol) + NODE_H + 40 : 0 };
    (colX[li] ||= []).push(x);
  }

  // Cross-cutting rows below the data flow.
  const ys = Object.values(positions).map((p) => p.y);
  let rowY = (ys.length ? Math.max(...ys) : 0) + NODE_H + 120;
  const minX = Object.values(positions).length ? Math.min(...Object.values(positions).map((p) => p.x)) : 0;
  for (const layer of CROSS_LAYERS) {
    const row = crossNodes.filter((n) => nodeLayer(n.layer, techIndex[n.tech_id]) === layer || (!CROSS_LAYERS.includes(nodeLayer(n.layer, techIndex[n.tech_id])) && layer === "operations"));
    if (!row.length) continue;
    const desired = row.map((n) => {
      const linked = arch.edges.flatMap((e) => (e.source === n.id ? [e.target] : e.target === n.id ? [e.source] : []))
        .map((id) => positions[id]).filter(Boolean) as Position[];
      const x = linked.length ? linked.reduce((s, p) => s + p.x, 0) / linked.length : minX;
      return { id: n.id, x };
    }).sort((a, b) => a.x - b.x);
    let cursor = -Infinity;
    for (const d of desired) {
      const x = Math.max(d.x, cursor + NODE_W + 36);
      positions[d.id] = { x, y: rowY };
      cursor = x;
    }
    rowY += NODE_H + 70;
  }
  return positions;
}

/** Bounding boxes for swimlanes, computed from current positions so they follow the user's edits. */
export interface Lane { id: string; label: string; x: number; y: number; width: number; height: number; orientation: "column" | "row" }

export function computeLanes(nodes: { id: string; layer: string; x: number; y: number }[]): Lane[] {
  const lanes: Lane[] = [];
  const pad = 26;
  const data = nodes.filter((n) => DATA_LAYERS.includes(n.layer));
  const cross = nodes.filter((n) => !DATA_LAYERS.includes(n.layer));
  if (data.length) {
    const top = Math.min(...data.map((n) => n.y)) - pad - 30;
    const bottom = Math.max(...data.map((n) => n.y + NODE_H)) + pad;
    for (const layer of DATA_LAYERS) {
      const members = data.filter((n) => n.layer === layer);
      if (!members.length) continue;
      const x0 = Math.min(...members.map((n) => n.x)) - pad;
      const x1 = Math.max(...members.map((n) => n.x + NODE_W)) + pad;
      lanes.push({ id: `lane-${layer}`, label: layer, x: x0, y: top, width: x1 - x0, height: bottom - top, orientation: "column" });
    }
  }
  if (cross.length) {
    const all = nodes;
    const left = Math.min(...all.map((n) => n.x)) - pad;
    const right = Math.max(...all.map((n) => n.x + NODE_W)) + pad;
    for (const layer of [...CROSS_LAYERS, "other"]) {
      const members = cross.filter((n) => (CROSS_LAYERS.includes(n.layer) ? n.layer : "other") === layer);
      if (!members.length) continue;
      const y0 = Math.min(...members.map((n) => n.y)) - pad - 22;
      const y1 = Math.max(...members.map((n) => n.y + NODE_H)) + pad - 6;
      lanes.push({ id: `lane-${layer}`, label: layer === "other" ? "operations" : layer, x: left, y: y0, width: right - left, height: y1 - y0, orientation: "row" });
    }
  }
  return lanes;
}
