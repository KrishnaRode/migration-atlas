"use client";
import {
  Background, BackgroundVariant, ConnectionMode, Controls, MarkerType, MiniMap, NodeToolbar, Position, ReactFlow,
  applyEdgeChanges, applyNodeChanges, useReactFlow, type EdgeChange, type NodeChange,
} from "@xyflow/react";
import { ArrowRight, Copy, FileText, MessageSquare, Replace, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TechIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { NODE_W } from "@/lib/layout";
import { useStudio, type ArchFlowEdge, type TechFlowNode } from "@/lib/studio-store";
import type { ConnectionAssessment, TechCard } from "@/lib/types";
import { STATUS_META, STRATEGY_NAMES } from "@/lib/utils";
import { Frames } from "./Frames";
import { SmartEdge } from "./SmartEdge";
import { TechNode } from "./TechNode";

const nodeTypes = { tech: TechNode };
const edgeTypes = { smart: SmartEdge };

interface Menu { x: number; y: number; nodeId?: string; edgeId?: string }

export function Canvas() {
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const fitNonce = useStudio((s) => s.fitNonce);
  const { setFlow, record, connect, addTech, select, removeElements, duplicate, set, askAI, updateNode } = useStudio.getState();
  const rf = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Menu | null>(null);

  useEffect(() => {
    if (!nodes.length) return;
    const t = setTimeout(() => rf.fitView({ padding: 0.12, duration: 650, maxZoom: 1.05 }), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);

  const onNodesChange = useCallback((changes: NodeChange<TechFlowNode>[]) => {
    const st = useStudio.getState();
    const removed = changes.filter((c) => c.type === "remove").map((c) => (c as { id: string }).id);
    if (removed.length) {
      st.removeElements(removed, []);
      return;
    }
    if (changes.some((c) => c.type === "position" && c.dragging && !st.nodes.find((n) => n.id === c.id)?.dragging)) record();
    setFlow(applyNodeChanges(changes, st.nodes), st.edges);
  }, [record, setFlow]);

  const onEdgesChange = useCallback((changes: EdgeChange<ArchFlowEdge>[]) => {
    const st = useStudio.getState();
    const removed = changes.filter((c) => c.type === "remove").map((c) => (c as { id: string }).id);
    if (removed.length) {
      st.removeElements([], removed);
      return;
    }
    setFlow(st.nodes, applyEdgeChanges(changes, st.edges));
  }, [setFlow]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const techId = e.dataTransfer.getData("application/atlas-tech");
    if (!techId) return;
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addTech(techId, { x: p.x - NODE_W / 2, y: p.y - 38 });
  }, [rf, addTech]);

  const defaultEdgeOptions = useMemo(() => ({ type: "smart", markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "var(--faint)" } }), []);

  return (
    <div ref={wrapper} className="relative h-full w-full" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges.map((e) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: edgeColor(e) } }))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(c) => c.source && c.target && connect(c.source, c.target)}
        connectionMode={ConnectionMode.Loose}
        onNodeClick={(_, n) => { select(n.id, null); setMenu(null); }}
        onEdgeClick={(_, e) => { select(null, e.id); setMenu(null); set({ rightTab: "inspector", rightOpen: true }); }}
        onPaneClick={() => { select(null, null); setMenu(null); set({ suggestionFor: null }); }}
        onNodeContextMenu={(e, n) => { e.preventDefault(); select(n.id, null); setMenu({ x: e.clientX, y: e.clientY, nodeId: n.id }); }}
        onEdgeContextMenu={(e, ed) => { e.preventDefault(); select(null, ed.id); setMenu({ x: e.clientX, y: e.clientY, edgeId: ed.id }); }}
        onNodeDragStop={() => useStudio.getState().set({ dirtyAt: Date.now() })}
        snapToGrid
        snapGrid={[8, 8]}
        minZoom={0.15}
        maxZoom={2}
        selectionOnDrag
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnPinch
        multiSelectionKeyCode={["Meta", "Shift", "Control"]}
        deleteKeyCode={["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.3} color="var(--dot)" />
        <Frames />
        <MiniMap pannable zoomable nodeStrokeWidth={2} nodeBorderRadius={6}
          nodeColor={(n) => ((n as TechFlowNode).data.tech?.legacy ? "var(--legacy)" : (n as TechFlowNode).data.tech?.color || "var(--accent)")}
          maskColor="color-mix(in srgb, var(--bg) 70%, transparent)" style={{ width: 168, height: 108 }} />
        <Controls showInteractive={false} position="bottom-left" />
        <SuggestionToolbar />
      </ReactFlow>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} actions={{ removeElements, duplicate, set, askAI, updateNode }} />}
    </div>
  );
}

function edgeColor(e: ArchFlowEdge): string {
  const st = e.data?.arch.status;
  if (st && st !== "VALID" && st !== "UNKNOWN") return STATUS_META[st].color;
  return e.data?.arch.kind === "data" ? "color-mix(in srgb, var(--accent) 60%, var(--border-strong))" : "var(--faint)";
}

/** "Possible next components" — shown right after a component is dropped. */
function SuggestionToolbar() {
  const nodeId = useStudio((s) => s.suggestionFor);
  const node = useStudio((s) => s.nodes.find((n) => n.id === s.suggestionFor));
  const [items, setItems] = useState<{ technology: TechCard; assessment: ConnectionAssessment }[] | null>(null);
  useEffect(() => {
    setItems(null);
    if (!node) return;
    const st = useStudio.getState();
    const present = st.nodes.map((n) => n.data.arch.tech_id);
    const cloud = st.architecture()?.meta.target_cloud;
    api.suggestions(node.data.arch.tech_id, present, cloud).then(setItems).catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);
  if (!node || !items || !items.length) return null;
  const isPlatform = node.data.tech?.role === "cloud-platform";
  const add = async (t: TechCard) => {
    const st = useStudio.getState();
    const siblings = st.edges.filter((e) => e.source === node.id).length;
    const id = st.addTech(t.id, { x: node.position.x + NODE_W + 90, y: node.position.y + siblings * 100 });
    if (id && !isPlatform) await st.connect(node.id, id);
    st.set({ suggestionFor: node.id });
  };
  return (
    <NodeToolbar nodeId={node.id} isVisible position={Position.Right} offset={16} align="start">
      <div className="w-[268px] animate-pop rounded-2xl border border-border bg-surface p-2 shadow-lift">
        <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold"><Sparkles size={12} className="text-accent" /> Possible next components</div>
          <button onClick={() => useStudio.getState().set({ suggestionFor: null })} className="rounded p-0.5 text-faint hover:text-text"><X size={13} /></button>
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {items.map(({ technology: t, assessment: a }) => (
            <button key={t.id} onClick={() => add(t)} title={a.reason}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-2">
              <TechIcon icon={t.icon} color={t.color} size={26} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium">{t.name}</div>
                <div className="truncate text-[10.5px] text-faint">{isPlatform ? t.vendor : a.reason}</div>
              </div>
              {!isPlatform && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_META[a.status].color }} />}
              <ArrowRight size={13} className="shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
        <div className="px-2 pb-1 pt-1.5 text-[10.5px] text-faint">From the technology ontology · click to add {isPlatform ? "" : "& connect"}</div>
      </div>
    </NodeToolbar>
  );
}

function ContextMenu({ menu, onClose, actions }: { menu: Menu; onClose: () => void;
  actions: Pick<ReturnType<typeof useStudio.getState>, "removeElements" | "duplicate" | "set" | "askAI" | "updateNode"> }) {
  const node = useStudio((s) => s.nodes.find((n) => n.id === menu.nodeId));
  const edge = useStudio((s) => s.edges.find((e) => e.id === menu.edgeId));
  const nodeName = (id: string) => {
    const n = useStudio.getState().nodes.find((x) => x.id === id);
    return n?.data.arch.label || n?.data.tech?.name || id;
  };
  const [strategyOpen, setStrategyOpen] = useState(false);
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", close); };
  }, [onClose]);
  // A render helper, not a component: a component defined here would remount on every store update
  // and swallow clicks that straddle a re-render.
  const Item = ({ icon: Icon, label, onClick, danger }: { icon: typeof Copy; label: string; onClick: () => void; danger?: boolean }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); onClose(); }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-surface-2 ${danger ? "text-bad" : "text-text"}`}>
      <Icon size={14} className={danger ? "" : "text-muted"} /> {label}
    </button>
  );
  return (
    <div className="fixed z-50 w-56 animate-pop rounded-xl border border-border bg-surface p-1 shadow-lift" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
      {node && (
        <>
          <div className="truncate px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-faint">{node.data.arch.label || node.data.tech?.name}</div>
          {Item({ icon: Replace, label: "Replace with…", onClick: () => actions.set({ replaceFor: node.id }) })}
          {Item({ icon: MessageSquare, label: "Ask AI about this", onClick: () => actions.askAI(`Explain the role of ${node.data.tech?.name} in this architecture and what to watch out for when migrating.`) })}
          {Item({ icon: Wand2, label: "Suggest next components", onClick: () => actions.set({ suggestionFor: node.id }) })}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setStrategyOpen(!strategyOpen); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-surface-2">
              <ArrowRight size={14} className="text-muted" /> Migration strategy
              <span className="ml-auto text-[11px] text-faint">{STRATEGY_NAMES[node.data.arch.strategy || ""] || "—"}</span>
            </button>
            {strategyOpen && (
              <div className="grid grid-cols-2 gap-0.5 px-1 pb-1">
                {Object.entries(STRATEGY_NAMES).map(([id, name]) => (
                  <button key={id} onClick={(e) => { e.stopPropagation(); actions.updateNode(node.id, { strategy: id }); onClose(); }}
                    className="rounded-md px-2 py-1 text-left text-[11.5px] hover:bg-surface-2">{name}</button>
                ))}
              </div>
            )}
          </div>
          {Item({ icon: FileText, label: "Record a decision (ADR)", onClick: () => actions.set({ adrDraft: { title: `Use ${node.data.tech?.name}`, related_nodes: [node.id],
            context: node.data.arch.replaces.length ? `Replaces ${node.data.arch.replaces.join(", ")} in the target architecture.` : "" } }) })}
          {Item({ icon: Copy, label: "Duplicate", onClick: () => actions.duplicate([node.id]) })}
          {Item({ icon: Trash2, label: "Delete", danger: true, onClick: () => actions.removeElements([node.id], []) })}
        </>
      )}
      {edge && (
        <>
          <div className="truncate px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-faint">{nodeName(edge.source)} → {nodeName(edge.target)}</div>
          {Item({ icon: MessageSquare, label: "Explain this connection", onClick: () => actions.askAI("Explain this connection: why is it here, what flows over it, and what should I watch out for?") })}
          {Item({ icon: Trash2, label: "Delete connection", danger: true, onClick: () => actions.removeElements([], [edge.id]) })}
        </>
      )}
    </div>
  );
}
