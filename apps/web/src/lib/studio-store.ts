"use client";
// Studio state: the active architecture as React Flow nodes/edges, undo/redo, validation,
// selection and panels. The backend architecture model is the source of truth for saving.
import type { Edge, Node } from "@xyflow/react";
import { create } from "zustand";
import { api } from "./api";
import { layoutArchitecture, NODE_H, NODE_W } from "./layout";
import type {
  Architecture, ArchitectureDecision, ArchitectureEdge, ArchitectureNode, ChatMessage, ConnectionAssessment, Persona,
  Project, Proposal, Roadmap, Severity, TechCard, ValidationReport,
} from "./types";
import { SEVERITY_ORDER, uid } from "./utils";

export interface TechNodeData extends Record<string, unknown> {
  arch: ArchitectureNode;
  tech?: TechCard;
  severity?: Severity | null;
  findingCount?: number;
  delay?: number; // entrance animation delay (ms)
  highlight?: boolean;
}
export interface ArchEdgeData extends Record<string, unknown> {
  arch: ArchitectureEdge;
  assessment?: ConnectionAssessment;
  delay?: number;
}
export type TechFlowNode = Node<TechNodeData, "tech">;
export type ArchFlowEdge = Edge<ArchEdgeData, "smart">;

export type View = "canvas" | "leader" | "developer" | "architect" | "roadmap" | "compare";
export type RightTab = "inspector" | "ai" | "validation";

interface Snapshot { nodes: TechFlowNode[]; edges: ArchFlowEdge[] }

export interface Toast { id: string; title: string; body?: string; tone?: "ok" | "warn" | "bad" | "info"; action?: { label: string; run: () => void } }

interface StudioState {
  project: Project | null;
  activeId: string | null;
  techIndex: Record<string, TechCard>;
  nodes: TechFlowNode[];
  edges: ArchFlowEdge[];
  past: Snapshot[];
  future: Snapshot[];
  validation: ValidationReport | null;
  validating: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  persona: Persona;
  view: View;
  rightTab: RightTab;
  rightOpen: boolean;
  libraryOpen: boolean;
  swimlanes: boolean;
  proposals: Proposal[];
  suggestionFor: string | null;
  replaceFor: string | null;
  toasts: Toast[];
  saving: boolean;
  dirtyAt: number;
  chatSeed: { text: string; nonce: number } | null;
  paletteOpen: boolean;
  whatIfOpen: boolean;
  adrDraft: Partial<ArchitectureDecision> | null;
  fitNonce: number;

  init: (project: Project, techs: TechCard[]) => Promise<void>;
  setPersona: (p: Persona) => void;
  setView: (v: View) => void;
  setRightTab: (t: RightTab) => void;
  toggle: (k: "rightOpen" | "libraryOpen" | "swimlanes" | "paletteOpen" | "whatIfOpen") => void;
  set: (patch: Partial<StudioState>) => void;
  architecture: () => Architecture | null;
  loadArchitecture: (arch: Architecture, opts?: { layout?: boolean; animate?: boolean; record?: boolean }) => Promise<void>;
  addOption: (arch: Architecture) => Promise<void>;
  switchOption: (id: string) => Promise<void>;
  renameOption: (id: string, name: string) => void;
  deleteOption: (id: string) => void;
  record: () => void;
  undo: () => void;
  redo: () => void;
  setFlow: (nodes: TechFlowNode[], edges: ArchFlowEdge[]) => void;
  addTech: (techId: string, position: { x: number; y: number }) => string | null;
  connect: (source: string, target: string) => Promise<void>;
  updateNode: (id: string, patch: Partial<ArchitectureNode>) => void;
  updateEdge: (id: string, patch: Partial<ArchitectureEdge>) => void;
  removeElements: (nodeIds: string[], edgeIds: string[]) => void;
  duplicate: (ids: string[]) => void;
  groupSelection: (label?: string) => void;
  select: (nodeId: string | null, edgeId?: string | null) => void;
  validate: () => Promise<void>;
  applyProposal: (p: Proposal) => Promise<void>;
  replaceNode: (nodeId: string, techId: string) => Promise<string[]>;
  relayout: () => Promise<void>;
  setRoadmap: (r: Roadmap | null, controls?: string[]) => void;
  setDecisions: (d: ArchitectureDecision[]) => void;
  setConversations: (c: ChatMessage[]) => void;
  askAI: (text: string) => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  save: () => Promise<void>;
}

const LAYER_DELAY = ["sources", "ingestion", "storage", "processing", "serving", "consumption", "governance", "security", "operations"];

function toFlow(arch: Architecture, techIndex: Record<string, TechCard>, animate = false): { nodes: TechFlowNode[]; edges: ArchFlowEdge[] } {
  const nodes: TechFlowNode[] = arch.nodes.map((n, i) => {
    const tech = techIndex[n.tech_id];
    const li = LAYER_DELAY.indexOf(n.layer || tech?.layer || "processing");
    return {
      id: n.id, type: "tech", position: n.position || { x: i * 40, y: i * 30 },
      width: NODE_W, height: NODE_H,
      data: { arch: n, tech, delay: animate ? Math.max(0, li) * 170 + (i % 4) * 45 : 0 },
    };
  });
  const edges: ArchFlowEdge[] = arch.edges.map((e) => ({
    id: e.id, source: e.source, target: e.target, type: "smart",
    data: { arch: e, delay: animate ? 900 + Math.random() * 600 : 0 },
  }));
  return { nodes, edges };
}

function fromFlow(base: Architecture, nodes: TechFlowNode[], edges: ArchFlowEdge[]): Architecture {
  return {
    ...base,
    nodes: nodes.map((n) => ({ ...n.data.arch, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) } })),
    edges: edges.map((e) => ({ ...e.data!.arch, source: e.source, target: e.target })),
  };
}

let validateTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStudio = create<StudioState>((set, get) => {
  const touch = () => {
    set({ dirtyAt: Date.now() });
    if (validateTimer) clearTimeout(validateTimer);
    validateTimer = setTimeout(() => get().validate(), 450);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => get().save(), 1200);
  };

  const syncActive = (): Project | null => {
    const { project, activeId } = get();
    const arch = get().architecture();
    if (!project || !arch) return project;
    return { ...project, options: project.options.map((o) => (o.id === activeId ? arch : o)), active_option_id: activeId };
  };

  return {
    project: null, activeId: null, techIndex: {}, nodes: [], edges: [], past: [], future: [],
    validation: null, validating: false, selectedNodeId: null, selectedEdgeId: null,
    persona: "architect", view: "canvas", rightTab: "inspector", rightOpen: true, libraryOpen: true, swimlanes: false,
    proposals: [], suggestionFor: null, replaceFor: null, toasts: [], saving: false, dirtyAt: 0, chatSeed: null,
    paletteOpen: false, whatIfOpen: false, adrDraft: null, fitNonce: 0,

    init: async (project, techs) => {
      const techIndex = Object.fromEntries(techs.map((t) => [t.id, t]));
      const active = project.options.find((o) => o.id === project.active_option_id) || project.options[0] || null;
      set({ project, techIndex, activeId: active?.id || null, past: [], future: [], validation: null, proposals: [],
        selectedNodeId: null, selectedEdgeId: null, view: "canvas" });
      if (active) await get().loadArchitecture(active, { layout: active.nodes.some((n) => !n.position), record: false });
      else set({ nodes: [], edges: [] });
    },

    setPersona: (persona) => set({ persona }),
    setView: (view) => {
      const persona = view === "leader" || view === "developer" || view === "architect" ? view : get().persona;
      set({ view, persona });
    },
    setRightTab: (rightTab) => set({ rightTab, rightOpen: true }),
    toggle: (k) => set({ [k]: !get()[k] } as Partial<StudioState>),
    set: (patch) => set(patch),

    architecture: () => {
      const { project, activeId, nodes, edges } = get();
      const base = project?.options.find((o) => o.id === activeId);
      return base ? fromFlow(base, nodes, edges) : null;
    },

    loadArchitecture: async (arch, opts = {}) => {
      const { techIndex, project } = get();
      if (opts.record !== false && get().nodes.length) get().record();
      let a = arch;
      if (opts.layout) {
        const pos = await layoutArchitecture(arch, techIndex);
        a = { ...arch, nodes: arch.nodes.map((n) => ({ ...n, position: pos[n.id] || n.position || { x: 0, y: 0 } })) };
      } else {
        // Place any node that arrived without a position (e.g. added by a proposal) next to its neighbours.
        const known = Object.fromEntries(arch.nodes.filter((n) => n.position).map((n) => [n.id, n.position!]));
        a = { ...arch, nodes: arch.nodes.map((n) => {
          if (n.position) return n;
          const near = arch.edges.flatMap((e) => (e.source === n.id ? [e.target] : e.target === n.id ? [e.source] : [])).map((id) => known[id]).filter(Boolean);
          const base = near.length ? { x: near.reduce((s, p) => s + p.x, 0) / near.length, y: Math.max(...near.map((p) => p.y)) + NODE_H + 70 } : { x: 0, y: 0 };
          const p = { ...base };
          while (Object.values(known).some((k) => Math.abs(k.x - p.x) < NODE_W && Math.abs(k.y - p.y) < NODE_H + 10)) p.x += NODE_W + 30;
          known[n.id] = p;
          return { ...n, position: p };
        }) };
      }
      const flow = toFlow(a, techIndex, opts.animate);
      const options = project ? (project.options.some((o) => o.id === a.id) ? project.options.map((o) => (o.id === a.id ? a : o)) : [...project.options, a]) : [];
      set({ ...flow, activeId: a.id, project: project ? { ...project, options, active_option_id: a.id } : project, fitNonce: get().fitNonce + 1 });
      touch();
    },

    addOption: async (arch) => {
      const { project } = get();
      if (!project) return;
      const letter = String.fromCharCode(65 + project.options.length);
      const named = { ...arch, name: arch.name.startsWith("Option") || arch.meta.what_if ? arch.name : `Option ${letter} · ${arch.name}` };
      set({ project: { ...syncActive()!, options: [...(syncActive()?.options || []), named] }, past: [], future: [] });
      await get().loadArchitecture(named, { layout: true, animate: true, record: false });
    },

    switchOption: async (id) => {
      const synced = syncActive();
      const target = synced?.options.find((o) => o.id === id);
      if (!synced || !target) return;
      set({ project: synced, past: [], future: [], selectedNodeId: null, selectedEdgeId: null });
      await get().loadArchitecture(target, { layout: target.nodes.some((n) => !n.position), record: false });
    },

    renameOption: (id, name) => {
      const synced = syncActive();
      if (!synced) return;
      set({ project: { ...synced, options: synced.options.map((o) => (o.id === id ? { ...o, name } : o)) } });
      touch();
    },

    deleteOption: (id) => {
      const synced = syncActive();
      if (!synced || synced.options.length < 2) return;
      const options = synced.options.filter((o) => o.id !== id);
      set({ project: { ...synced, options } });
      if (get().activeId === id) void get().switchOption(options[0].id);
      touch();
    },

    record: () => {
      const { nodes, edges, past } = get();
      set({ past: [...past.slice(-60), { nodes, edges }], future: [] });
    },
    undo: () => {
      const { past, nodes, edges, future } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({ nodes: prev.nodes, edges: prev.edges, past: past.slice(0, -1), future: [{ nodes, edges }, ...future] });
      touch();
    },
    redo: () => {
      const { future, nodes, edges, past } = get();
      const next = future[0];
      if (!next) return;
      set({ nodes: next.nodes, edges: next.edges, future: future.slice(1), past: [...past, { nodes, edges }] });
      touch();
    },

    setFlow: (nodes, edges) => {
      set({ nodes, edges });
      set({ dirtyAt: Date.now() });
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => get().save(), 1500);
    },

    addTech: (techId, position) => {
      const tech = get().techIndex[techId];
      if (!tech) return null;
      get().record();
      const arch: ArchitectureNode = { id: uid("n"), tech_id: techId, layer: tech.layer, origin: "user", replaces: [],
        environment: tech.legacy || tech.environment === "on-prem" ? "On-Prem" : tech.clouds.length === 1 ? ({ gcp: "GCP", aws: "AWS", azure: "Azure" } as Record<string, string>)[tech.clouds[0]] || "Cloud" : "Cloud" };
      const node: TechFlowNode = { id: arch.id, type: "tech", position, width: NODE_W, height: NODE_H, data: { arch, tech, delay: 0 }, selected: true };
      set({ nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), node], selectedNodeId: arch.id, selectedEdgeId: null, suggestionFor: arch.id });
      touch();
      return arch.id;
    },

    connect: async (source, target) => {
      const { nodes, edges } = get();
      if (source === target || edges.some((e) => e.source === source && e.target === target)) return;
      const s = nodes.find((n) => n.id === source);
      const t = nodes.find((n) => n.id === target);
      if (!s || !t) return;
      get().record();
      const id = uid("e");
      const arch: ArchitectureEdge = { id, source, target, kind: "data", origin: "user" };
      const edge: ArchFlowEdge = { id, source, target, type: "smart", data: { arch }, selected: true };
      set({ edges: [...edges.map((e) => ({ ...e, selected: false })), edge], selectedEdgeId: id, selectedNodeId: null, rightTab: "inspector", rightOpen: true });
      try {
        const a = await api.assess(s.data.arch.tech_id, t.data.arch.tech_id);
        set({ edges: get().edges.map((e) => (e.id === id ? { ...e, data: { arch: { ...arch, kind: a.kind, mode: a.mode, status: a.status }, assessment: a } } : e)) });
        if (a.status === "INVALID") get().toast({ title: "This connection doesn't make technical sense", body: a.reason, tone: "bad" });
      } catch { /* validation will annotate later */ }
      touch();
    },

    updateNode: (id, patch) => {
      get().record();
      set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, arch: { ...n.data.arch, ...patch } } } : n)) });
      touch();
    },
    updateEdge: (id, patch) => {
      get().record();
      set({ edges: get().edges.map((e) => (e.id === id ? { ...e, data: { ...e.data!, arch: { ...e.data!.arch, ...patch } } } : e)) });
      touch();
    },

    removeElements: (nodeIds, edgeIds) => {
      if (!nodeIds.length && !edgeIds.length) return;
      get().record();
      const ns = new Set(nodeIds);
      const es = new Set(edgeIds);
      set({
        nodes: get().nodes.filter((n) => !ns.has(n.id)),
        edges: get().edges.filter((e) => !es.has(e.id) && !ns.has(e.source) && !ns.has(e.target)),
        selectedNodeId: null, selectedEdgeId: null,
      });
      touch();
    },

    duplicate: (ids) => {
      const src = get().nodes.filter((n) => ids.includes(n.id));
      if (!src.length) return;
      get().record();
      const copies = src.map((n) => {
        const id = uid("n");
        return { ...n, id, selected: true, position: { x: n.position.x + 40, y: n.position.y + 40 },
          data: { ...n.data, delay: 0, arch: { ...n.data.arch, id, origin: "user" as const } } };
      });
      set({ nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), ...copies] });
      touch();
    },

    groupSelection: (label) => {
      const sel = get().nodes.filter((n) => n.selected).map((n) => n.id);
      const synced = syncActive();
      if (sel.length < 2 || !synced) return;
      const arch = get().architecture()!;
      const group = { id: uid("g"), label: label || `Group ${arch.groups.length + 1}`, node_ids: sel };
      const updated = { ...arch, groups: [...arch.groups, group] };
      set({ project: { ...synced, options: synced.options.map((o) => (o.id === arch.id ? updated : o)) } });
      get().toast({ title: `Grouped ${sel.length} components`, tone: "ok" });
      touch();
    },

    select: (nodeId, edgeId = null) => set({ selectedNodeId: nodeId, selectedEdgeId: edgeId }),

    validate: async () => {
      const arch = get().architecture();
      if (!arch) return;
      set({ validating: true });
      try {
        const report = await api.validate(arch, get().project?.estate);
        const sevByNode: Record<string, Severity> = {};
        const countByNode: Record<string, number> = {};
        for (const f of report.findings) {
          if (f.severity === "info") continue;
          for (const id of f.node_ids) {
            countByNode[id] = (countByNode[id] || 0) + 1;
            if (!sevByNode[id] || SEVERITY_ORDER.indexOf(f.severity) < SEVERITY_ORDER.indexOf(sevByNode[id])) sevByNode[id] = f.severity;
          }
        }
        set({
          validation: report,
          nodes: get().nodes.map((n) => ({ ...n, data: { ...n.data, severity: sevByNode[n.id] || null, findingCount: countByNode[n.id] || 0 } })),
          edges: get().edges.map((e) => {
            const a = report.edge_status[e.id];
            return a ? { ...e, data: { ...e.data!, arch: { ...e.data!.arch, status: a.status }, assessment: a } } : e;
          }),
          proposals: report.findings.filter((f) => f.proposal).map((f) => f.proposal!) ,
        });
      } catch { /* backend unreachable — keep last report */ } finally {
        set({ validating: false });
      }
    },

    applyProposal: async (p) => {
      const arch = get().architecture();
      if (!arch) return;
      const before = new Set(arch.nodes.map((n) => n.id));
      const res = await api.applyProposal(arch, p, get().project?.estate);
      await get().loadArchitecture(res.architecture, { layout: false });
      const added = res.architecture.nodes.filter((n) => !before.has(n.id)).map((n) => n.id);
      set({ nodes: get().nodes.map((n) => (added.includes(n.id) ? { ...n, data: { ...n.data, highlight: true, delay: 0 } } : n)),
        proposals: get().proposals.filter((x) => x.id !== p.id) });
      if (added[0]) set({ selectedNodeId: added[0], selectedEdgeId: null });
      if (p.operations.some((o) => o.op === "set_control")) {
        const value = p.operations.find((o) => o.op === "set_control")?.value;
        get().toast({ title: `${p.title}`, body: `Recorded as a migration control (${value}). The roadmap will detail it.`, tone: "ok" });
      } else get().toast({ title: "Applied", body: p.title, tone: "ok" });
    },

    replaceNode: async (nodeId, techId) => {
      const arch = get().architecture();
      if (!arch) return [];
      const res = await api.replace(arch, nodeId, techId);
      await get().loadArchitecture(res.architecture, { layout: false });
      set({ nodes: get().nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, highlight: true } } : n)), selectedNodeId: nodeId, selectedEdgeId: null, replaceFor: null });
      return res.changes;
    },

    relayout: async () => {
      const arch = get().architecture();
      if (!arch) return;
      await get().loadArchitecture({ ...arch, nodes: arch.nodes.map((n) => ({ ...n, position: null })) }, { layout: true });
    },

    setRoadmap: (roadmap, controls) => {
      const synced = syncActive();
      if (!synced) return;
      let options = synced.options;
      if (controls) {
        options = options.map((o) => (o.id === get().activeId ? { ...o, meta: { ...o.meta, migration_controls: Array.from(new Set([...o.meta.migration_controls, ...controls])) } } : o));
      }
      set({ project: { ...synced, roadmap, options } });
      touch();
    },
    setDecisions: (decisions) => {
      const synced = syncActive();
      if (!synced) return;
      set({ project: { ...synced, decisions } });
      touch();
    },
    setConversations: (conversations) => {
      const p = get().project;
      if (!p) return;
      set({ project: { ...p, conversations } });
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => get().save(), 1200);
    },
    askAI: (text) => set({ chatSeed: { text, nonce: Date.now() }, rightTab: "ai", rightOpen: true }),

    toast: (t) => {
      const id = uid("t");
      set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
      setTimeout(() => get().dismissToast(id), t.action ? 12000 : 6500);
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

    save: async () => {
      const synced = syncActive();
      if (!synced) return;
      set({ saving: true, project: synced });
      try {
        await api.saveProject(synced);
      } catch { /* surfaced by the status chip */ } finally {
        set({ saving: false });
      }
    },
  };
});

// Handy for debugging and scripted demos in development builds.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __atlasStudio: typeof useStudio }).__atlasStudio = useStudio;
}
