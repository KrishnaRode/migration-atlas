"use client";
import { ArrowRight, ExternalLink, FileText, Lightbulb, MessageSquare, Replace, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, SectionLabel, TechIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { useStudio } from "@/lib/studio-store";
import type { EdgeKind, TechnologyDetail } from "@/lib/types";
import { CLOUD_NAMES, LAYER_NAMES, STATUS_META, STRATEGY_NAMES, cn } from "@/lib/utils";
import { categoryLabel } from "../canvas/TechNode";

const input = "h-8 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[12.5px] outline-none transition-colors focus:border-accent focus:bg-surface";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1 text-[11px] font-medium text-faint">{label}</div>{children}</label>;
}

export function Inspector() {
  const nodeId = useStudio((s) => s.selectedNodeId);
  const edgeId = useStudio((s) => s.selectedEdgeId);
  if (edgeId) return <EdgeInspector id={edgeId} />;
  if (nodeId) return <NodeInspector id={nodeId} />;
  return <ArchitectureOverview />;
}

function NodeInspector({ id }: { id: string }) {
  const node = useStudio((s) => s.nodes.find((n) => n.id === id));
  const incoming = useStudio((s) => s.edges.filter((e) => e.target === id).length);
  const outgoing = useStudio((s) => s.edges.filter((e) => e.source === id).length);
  const techIndex = useStudio((s) => s.techIndex);
  const [detail, setDetail] = useState<TechnologyDetail | null>(null);
  const techId = node?.data.arch.tech_id;
  useEffect(() => {
    setDetail(null);
    if (techId) api.technology(techId).then(setDetail).catch(() => setDetail(null));
  }, [techId]);
  if (!node) return null;
  const { arch, tech } = node.data;
  const st = useStudio.getState();
  return (
    <div className="space-y-4 p-3.5 animate-fade">
      <div className="flex items-start gap-3">
        <TechIcon icon={tech?.icon} color={tech?.color} size={44} muted={tech?.legacy} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight">{arch.label || tech?.name}</div>
          <div className="mt-0.5 text-[11.5px] text-faint">{tech && `${categoryLabel(tech.category)} · ${tech.vendor}`}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tech?.legacy ? <Badge color="var(--legacy)">Legacy</Badge> : <Badge color="var(--modern)">Modern</Badge>}
            {arch.origin === "ai" && <Badge color="var(--accent)"><Sparkles size={10} /> Added by AI</Badge>}
            {tech && <Badge>{tech.operational_model}</Badge>}
            <Badge>{incoming} in · {outgoing} out</Badge>
          </div>
        </div>
      </div>
      {tech && <p className="text-[12.5px] leading-relaxed text-muted">{tech.description}</p>}
      {arch.notes && (
        <div className="flex gap-2 rounded-xl bg-accent-soft p-2.5 text-[12px]"><Lightbulb size={14} className="mt-0.5 shrink-0 text-accent" /><span>{arch.notes}</span></div>
      )}
      {arch.replaces.length > 0 && (
        <div className="text-[12px] text-muted">Replaces <span className="font-medium text-text">{arch.replaces.map((r) => techIndex[r]?.name || r).join(", ")}</span></div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="primary" icon={Replace} onClick={() => st.set({ replaceFor: id })}>Replace with…</Button>
        <Button size="sm" icon={MessageSquare} onClick={() => st.askAI(`Why is ${tech?.name} in this architecture, and what should I watch out for when migrating it?`)}>Ask AI</Button>
        <Button size="sm" icon={FileText} onClick={() => st.set({ adrDraft: { title: `Use ${tech?.name}`, related_nodes: [id] } })}>ADR</Button>
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => st.removeElements([id], [])} />
      </div>

      <div className="space-y-2.5">
        <SectionLabel>Properties</SectionLabel>
        <Field label="Label"><input className={input} defaultValue={arch.label || ""} key={`${id}-label`} placeholder={tech?.name}
          onBlur={(e) => e.target.value !== (arch.label || "") && st.updateNode(id, { label: e.target.value || null })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Environment"><input className={input} defaultValue={arch.environment || ""} key={`${id}-env`}
            onBlur={(e) => e.target.value !== (arch.environment || "") && st.updateNode(id, { environment: e.target.value || null })} /></Field>
          <Field label="Layer">
            <select className={input} value={arch.layer || tech?.layer || ""} onChange={(e) => st.updateNode(id, { layer: e.target.value })}>
              {Object.entries(LAYER_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        {tech?.legacy && (
          <Field label={`Migration strategy${arch.suggested_strategy && !arch.strategy ? ` · suggested: ${STRATEGY_NAMES[arch.suggested_strategy]}` : ""}`}>
            <div className="grid grid-cols-4 gap-1">
              {Object.entries(STRATEGY_NAMES).map(([k, v]) => (
                <button key={k} onClick={() => st.updateNode(id, { strategy: arch.strategy === k ? null : k })}
                  className={cn("h-7 rounded-md border text-[11px] font-medium transition-colors",
                    arch.strategy === k ? "border-accent bg-accent text-white" : arch.suggested_strategy === k ? "border-dashed border-accent text-accent" : "border-border text-muted hover:text-text")}>
                  {v}
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>

      {tech && (
        <div className="space-y-1.5">
          <SectionLabel>Capabilities</SectionLabel>
          <div className="flex flex-wrap gap-1">{(detail?.capabilities || tech.capabilities).map((c) => <Badge key={c}>{c}</Badge>)}</div>
          <div className="text-[11px] text-faint">Runs on {tech.clouds.map((c) => CLOUD_NAMES[c] || c).join(", ") || "—"}</div>
        </div>
      )}
      {detail && detail.migration_considerations.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Migration considerations</SectionLabel>
          <ul className="space-y-1 text-[12px] text-muted">{detail.migration_considerations.slice(0, 4).map((m, i) => <li key={i} className="flex gap-1.5"><span className="text-faint">•</span>{m}</li>)}</ul>
        </div>
      )}
      {detail && (detail.possible_targets_detail.length > 0 || detail.alternatives_detail.length > 0) && (
        <div className="space-y-1.5">
          <SectionLabel>{tech?.legacy ? "Common migration targets" : "Alternatives"}</SectionLabel>
          <div className="space-y-1">
            {(tech?.legacy ? detail.possible_targets_detail : detail.alternatives_detail).slice(0, 5).map((t) => (
              <button key={t.id} onClick={() => st.replaceNode(id, t.id).then((changes) => {
                st.toast({ title: `Replaced with ${t.name}`, body: changes.slice(0, 2).join(" "), tone: "ok" });
                st.askAI(`We replaced ${tech?.name} with ${t.name}. What changes operationally, and what should the team plan for?`);
              })}
                className="group flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface-2">
                <TechIcon icon={t.icon} color={t.color} size={22} />
                <span className="flex-1 truncate text-[12px]">{t.name}</span>
                <span className="text-[10.5px] text-faint opacity-0 group-hover:opacity-100">Replace</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {tech && <Link href={`/technologies/${tech.id}`} target="_blank" className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">Technology details <ExternalLink size={11} /></Link>}
    </div>
  );
}

function EdgeInspector({ id }: { id: string }) {
  const edge = useStudio((s) => s.edges.find((e) => e.id === id));
  const src = useStudio((s) => s.nodes.find((n) => n.id === edge?.source));
  const dst = useStudio((s) => s.nodes.find((n) => n.id === edge?.target));
  if (!edge || !edge.data) return null;
  const { arch, assessment } = edge.data;
  const st = useStudio.getState();
  const status = assessment?.status || arch.status || "UNKNOWN";
  const meta = STATUS_META[status];
  const set = (k: keyof typeof arch) => (e: React.FocusEvent<HTMLInputElement>) => {
    const v = e.target.value || null;
    if (v !== (arch[k] ?? null)) st.updateEdge(id, { [k]: v } as Partial<typeof arch>);
  };
  return (
    <div className="space-y-4 p-3.5 animate-fade">
      <div>
        <SectionLabel>Connection</SectionLabel>
        <div className="mt-2 flex items-center gap-2">
          <TechIcon icon={src?.data.tech?.icon} color={src?.data.tech?.color} size={28} muted={src?.data.tech?.legacy} />
          <ArrowRight size={14} className="text-faint" />
          <TechIcon icon={dst?.data.tech?.icon} color={dst?.data.tech?.color} size={28} muted={dst?.data.tech?.legacy} />
          <div className="min-w-0 flex-1 text-[12.5px] font-medium leading-tight">
            <div className="truncate">{src?.data.arch.label || src?.data.tech?.name}</div>
            <div className="truncate text-muted">→ {dst?.data.arch.label || dst?.data.tech?.name}</div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border p-3" style={{ borderColor: `color-mix(in srgb, ${meta.color} 35%, transparent)`, background: `color-mix(in srgb, ${meta.color} 6%, transparent)` }}>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: meta.color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} /> {status.replaceAll("_", " ")}
        </div>
        <div className="mt-1.5 text-[12.5px] leading-relaxed">{assessment?.reason || "Validating…"}</div>
        {assessment?.suggestion && <div className="mt-1.5 text-[12px] text-muted"><span className="font-medium text-text">Suggestion: </span>{assessment.suggestion}</div>}
        {assessment?.matched_rule && <div className="mt-2 font-mono text-[10.5px] text-faint">rule {assessment.matched_rule}</div>}
      </div>
      <Button size="sm" variant="primary" icon={Sparkles} onClick={() => st.askAI("Explain this connection: why is it here, what flows over it, and what should I watch out for?")}>
        Ask AI to explain
      </Button>
      <div className="space-y-2.5">
        <SectionLabel>Flow metadata</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kind">
            <select className={input} value={arch.kind} onChange={(e) => st.updateEdge(id, { kind: e.target.value as EdgeKind })}>
              {["data", "control", "governance", "security", "monitoring"].map((k) => <option key={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="Mode"><input className={input} list="modes" defaultValue={arch.mode || ""} key={`${id}-mode`} onBlur={set("mode")} placeholder="cdc, batch…" /></Field>
          <Field label="Frequency"><input className={input} defaultValue={arch.frequency || ""} key={`${id}-f`} onBlur={set("frequency")} placeholder="continuous" /></Field>
          <Field label="Latency"><input className={input} defaultValue={arch.latency || ""} key={`${id}-l`} onBlur={set("latency")} placeholder="near real time" /></Field>
          <Field label="Format"><input className={input} defaultValue={arch.format || ""} key={`${id}-fmt`} onBlur={set("format")} placeholder="change records" /></Field>
          <Field label="Label"><input className={input} defaultValue={arch.label || ""} key={`${id}-lab`} onBlur={set("label")} /></Field>
        </div>
        <datalist id="modes">{["cdc", "batch", "streaming", "api", "file", "query", "control", "governance"].map((m) => <option key={m} value={m} />)}</datalist>
      </div>
      <Button size="sm" variant="danger" icon={Trash2} onClick={() => st.removeElements([], [id])}>Delete connection</Button>
    </div>
  );
}

function ArchitectureOverview() {
  const arch = useStudio((s) => s.project?.options.find((o) => o.id === s.activeId));
  const count = useStudio((s) => s.nodes.length);
  if (!arch) return null;
  return (
    <div className="space-y-4 p-3.5 animate-fade">
      <div>
        <div className="text-[15px] font-semibold">{arch.name}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {arch.meta.target_cloud && <Badge color="var(--accent)">{CLOUD_NAMES[arch.meta.target_cloud] || arch.meta.target_cloud}</Badge>}
          {arch.meta.data_platform && <Badge color="var(--modern)">{arch.meta.data_platform}</Badge>}
          <Badge>{count} components</Badge>
          {arch.meta.generated_by && <Badge>{arch.meta.generated_by}</Badge>}
        </div>
        {arch.meta.what_if && <div className="mt-2 text-[12px] text-muted">What-if branch: “{arch.meta.what_if}”</div>}
      </div>
      {arch.meta.ai_status && <div className="rounded-xl bg-surface-2 p-2.5 text-[11.5px] text-muted"><Sparkles size={11} className="mr-1 inline text-accent" />{arch.meta.ai_status}</div>}
      {arch.architecture_notes.length > 0 && <List title="Architecture notes" items={arch.architecture_notes} />}
      {arch.assumptions.length > 0 && <List title="Assumptions" items={arch.assumptions} />}
      {arch.risks.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Risks</SectionLabel>
          {arch.risks.map((r, i) => (
            <div key={i} className="rounded-lg border border-border px-2.5 py-1.5 text-[12px]">
              <div className="flex items-center gap-1.5 font-medium"><span className="h-1.5 w-1.5 rounded-full" style={{ background: r.severity === "high" ? "var(--bad)" : r.severity === "medium" ? "var(--warn)" : "var(--info)" }} />{r.title}
                {r.source === "ai" && <Sparkles size={10} className="text-accent" />}</div>
              {r.detail && <div className="mt-0.5 text-muted">{r.detail}</div>}
            </div>
          ))}
        </div>
      )}
      {arch.meta.migration_controls.length > 0 && (
        <div className="space-y-1.5"><SectionLabel>Migration controls</SectionLabel>
          <div className="flex flex-wrap gap-1">{arch.meta.migration_controls.map((c) => <Badge key={c} color="var(--ok)">{c}</Badge>)}</div></div>
      )}
      <div className="rounded-xl border border-dashed border-border p-3 text-[11.5px] text-faint">Select a component or connection to inspect it. Right-click for Replace, strategy and ADRs.</div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <SectionLabel>{title}</SectionLabel>
      <ul className="space-y-1 text-[12px] leading-relaxed text-muted">
        {items.map((n, i) => <li key={i} className="flex gap-1.5"><span className="text-faint">•</span><span>{n.startsWith("AI: ") ? <><Sparkles size={10} className="mr-1 inline text-accent" />{n.slice(4)}</> : n}</span></li>)}
      </ul>
    </div>
  );
}
