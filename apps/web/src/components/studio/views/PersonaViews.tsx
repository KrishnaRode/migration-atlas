"use client";
import { ArrowRight, Boxes, CalendarRange, Code2, Download, FileText, GitBranch, Layers, Plus, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Button, SectionLabel, TechIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { useStudio } from "@/lib/studio-store";
import type { MigrationMapping, TechCard } from "@/lib/types";
import { CLOUD_NAMES, SEVERITY_COLOR, STRATEGY_NAMES } from "@/lib/utils";
import { HealthPanel } from "../panels/ValidationPanel";
import { DependencyView, useRoadmap } from "./RoadmapView";

function Section({ title, icon: Icon, children, className }: { title: string; icon?: typeof Layers; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-5 shadow-soft animate-rise ${className || ""}`}>
      <div className="mb-3 flex items-center gap-2">{Icon && <Icon size={15} className="text-accent" />}<h3 className="text-[14px] font-semibold">{title}</h3></div>
      {children}
    </section>
  );
}

function useArch() {
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const arch = useStudio((s) => s.project?.options.find((o) => o.id === s.activeId));
  const project = useStudio((s) => s.project);
  const validation = useStudio((s) => s.validation);
  const techIndex = useStudio((s) => s.techIndex);
  const name = (id: string) => { const n = nodes.find((x) => x.id === id); return n?.data.arch.label || n?.data.tech?.name || id; };
  const legacy = nodes.filter((n) => n.data.tech?.legacy);
  const modern = nodes.filter((n) => !n.data.tech?.legacy);
  return { nodes, edges, arch, project, validation, techIndex, name, legacy, modern };
}

function Chip({ t, label }: { t?: TechCard; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-[12px] font-medium">
      <TechIcon icon={t?.icon} color={t?.color} size={20} muted={t?.legacy} /> {label}
    </span>
  );
}

export function LeaderView() {
  const { arch, project, validation, legacy, modern, nodes } = useArch();
  const { roadmap, busy, generate } = useRoadmap();
  const st = useStudio.getState();
  if (!arch || !project) return null;
  const replaced = modern.filter((n) => n.data.arch.replaces.length);
  const skills = Array.from(new Set(modern.flatMap((n) => n.data.tech?.skills || []))).slice(0, 12);
  const managed = modern.filter((n) => ["managed", "serverless", "saas"].includes(n.data.tech?.operational_model || "")).length;
  const risks = [...(validation?.findings.filter((f) => f.severity === "critical" || f.severity === "high").map((f) => ({ title: f.title, sev: f.severity })) || []),
    ...arch.risks.filter((r) => r.severity === "high").map((r) => ({ title: r.title, sev: r.severity }))].slice(0, 6);
  const key = modern.filter((n) => ["lakehouse", "warehouse", "cdc", "governance", "streaming", "transformation", "serving"].includes(n.data.tech?.role || ""));
  return (
    <div className="mx-auto max-w-[1100px] space-y-5 px-8 py-8">
      <div>
        <div className="text-[12px] font-medium text-accent">Leader view</div>
        <h2 className="text-[26px] font-semibold tracking-tight">{project.name}</h2>
        <p className="mt-1 max-w-2xl text-[13.5px] text-muted">
          Modernising {project.estate.current_technologies.map((id) => st.techIndex[id]?.name || id).join(", ") || legacy.map((n) => n.data.tech?.name).join(", ") || "the legacy estate"} onto {arch.meta.data_platform ? st.techIndex[arch.meta.data_platform]?.name : "a modern platform"}
          {arch.meta.target_cloud ? ` on ${CLOUD_NAMES[arch.meta.target_cloud]}` : ""}. Technical detail is hidden here — switch to Canvas or Architect view for it.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <Section title="Current estate" icon={Boxes}><div className="flex flex-wrap gap-1.5">
          {(project.estate.current_technologies.length ? project.estate.current_technologies : legacy.map((n) => n.data.arch.tech_id))
            .map((id) => <Chip key={id} t={st.techIndex[id]} label={st.techIndex[id]?.name || id} />)}
        </div>{project.estate.data_volume_tb ? <div className="mt-2 text-[12px] text-faint">~{project.estate.data_volume_tb} TB of data</div> : null}</Section>
        <ArrowRight className="mx-auto hidden text-faint md:block" />
        <Section title="Target state" icon={Layers}><div className="flex flex-wrap gap-1.5">{key.map((n) => <Chip key={n.id} t={n.data.tech} label={n.data.arch.label || n.data.tech?.name || ""} />)}</div></Section>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {[{ k: "Legacy products retired or replaced", v: replaced.length + legacy.filter((n) => (n.data.arch.strategy || n.data.arch.suggested_strategy) === "retire").length },
          { k: "Managed / serverless services", v: `${managed} of ${modern.length}` },
          { k: "High-severity risks & findings to track", v: risks.length }].map((m) => (
          <div key={m.k} className="rounded-2xl border border-border bg-surface p-5 shadow-soft animate-rise">
            <div className="text-[30px] font-semibold tracking-tight">{m.v}</div><div className="mt-1 text-[12.5px] text-muted">{m.k}</div>
          </div>
        ))}
      </div>
      <Section title="Key modernization themes" icon={Layers}>
        <div className="flex flex-wrap gap-2">
          {(roadmap?.themes || arch.architecture_notes.slice(0, 4)).map((t) => <span key={t} className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px]">{t.replace(/^AI: /, "")}</span>)}
        </div>
      </Section>
      <Section title="Migration waves" icon={CalendarRange}>
        {roadmap ? (
          <div className="flex flex-wrap gap-2">
            {roadmap.waves.filter((w) => w.included).map((w) => (
              <div key={w.id} className="w-[150px] rounded-xl border border-border px-3 py-2"><div className="text-[10.5px] font-semibold uppercase tracking-wider text-faint">Wave {w.index}</div>
                <div className="text-[12.5px] font-medium">{w.name}</div></div>
            ))}
          </div>
        ) : <Button variant="primary" icon={CalendarRange} loading={busy} onClick={() => generate(false)}>Generate migration roadmap</Button>}
      </Section>
      {roadmap && <Section title="Major dependencies" icon={GitBranch}><DependencyView graph={roadmap.dependencies} /></Section>}
      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Key risks" icon={ShieldCheck}>
          <div className="space-y-1.5">{risks.map((r, i) => <div key={i} className="flex items-start gap-2 text-[13px]"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[r.sev] }} />{r.title}</div>)}
            {!risks.length && <div className="text-[13px] text-muted">No high-priority risks open.</div>}</div>
        </Section>
        <Section title="Skill implications" icon={Users}>
          <div className="flex flex-wrap gap-1.5">{skills.map((s) => <Badge key={s} color="var(--accent)">{s}</Badge>)}</div>
          <p className="mt-3 text-[12.5px] text-muted">Expected organisational impact: teams shift from operating {legacy.length} self-managed legacy product(s) toward code-first pipelines and managed services; plan enablement before Wave 5.</p>
        </Section>
      </div>
      <Section title="Architecture alternatives" icon={GitBranch}>
        <div className="flex flex-wrap gap-2">
          {project.options.map((o) => (
            <button key={o.id} onClick={() => st.switchOption(o.id)} className={`rounded-xl border px-3 py-2 text-left text-[12.5px] ${o.id === arch.id ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong"}`}>
              <div className="font-medium">{o.name}</div><div className="text-[11px] text-faint">{o.nodes.length} components{o.meta.what_if ? " · what-if" : ""}</div>
            </button>
          ))}
          <Button icon={Plus} onClick={() => st.set({ whatIfOpen: true })}>What if…?</Button>
        </div>
      </Section>
      <div className="text-[12px] text-faint">{nodes.length} components in the full architecture.</div>
    </div>
  );
}

export function DeveloperView() {
  const { legacy, modern, edges, name, techIndex, validation } = useArch();
  const [maps, setMaps] = useState<Record<string, MigrationMapping[]>>({});
  const sources = useMemo(() => Array.from(new Set([...legacy.map((n) => n.data.arch.tech_id), ...modern.flatMap((n) => n.data.arch.replaces)])), [legacy, modern]);
  useEffect(() => {
    sources.forEach((s) => { if (!maps[s]) api.mappings(s).then((m) => setMaps((x) => ({ ...x, [s]: m }))).catch(() => undefined); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.join(",")]);
  const flows = edges.filter((e) => e.data?.arch.kind === "data");
  return (
    <div className="mx-auto max-w-[1100px] space-y-5 px-8 py-8">
      <div><div className="text-[12px] font-medium text-accent">Developer view</div><h2 className="text-[26px] font-semibold tracking-tight">Source-to-target mappings</h2>
        <p className="mt-1 text-[13.5px] text-muted">Conversion approaches, code implications and validation steps for each legacy component.</p></div>
      {sources.map((s) => (maps[s] || []).map((m) => (
        <Section key={m.id} title={m.title || m.id} icon={Code2}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Chip t={techIndex[m.source]} label={m.source_artifact || techIndex[m.source]?.name || m.source} />
            <ArrowRight size={14} className="text-faint" />
            {m.targets.map((t) => <Chip key={t} t={techIndex[t]} label={techIndex[t]?.name || t} />)}
            <Badge color={m.automation_potential === "high" ? "var(--ok)" : m.automation_potential === "medium" ? "var(--warn)" : "var(--bad)"}>{m.automation_potential} automation potential</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div><SectionLabel>Approaches</SectionLabel><ul className="mt-1.5 space-y-1 text-[12.5px] text-muted">{m.approaches.map((a) => <li key={a}>• {a}</li>)}</ul></div>
            <div><SectionLabel>Code & conversion implications</SectionLabel><ul className="mt-1.5 space-y-1 text-[12.5px] text-muted">{m.conversion_considerations.map((a) => <li key={a}>• {a}</li>)}</ul></div>
            <div><SectionLabel>Manual effort areas</SectionLabel><ul className="mt-1.5 space-y-1 text-[12.5px] text-muted">{m.manual_effort_areas.map((a) => <li key={a}>• {a}</li>)}</ul></div>
          </div>
        </Section>
      )))}
      <Section title="Connection protocols & data flows" icon={ArrowRight}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wider text-faint"><tr><th className="py-1.5">From</th><th>To</th><th>Mode</th><th>Frequency</th><th>Latency</th><th>Format</th><th>Status</th></tr></thead>
            <tbody>{flows.map((e) => (
              <tr key={e.id} className="border-t border-border"><td className="py-1.5">{name(e.source)}</td><td>{name(e.target)}</td><td>{e.data?.arch.mode || "—"}</td>
                <td>{e.data?.arch.frequency || "—"}</td><td>{e.data?.arch.latency || "—"}</td><td>{e.data?.arch.format || "—"}</td><td className="text-[11px]">{e.data?.arch.status?.replaceAll("_", " ") || "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Section>
      <Section title="Validation steps" icon={ShieldCheck}>
        <ul className="space-y-1.5 text-[12.5px] text-muted">
          <li>• Row counts per table and partition between source and target after every load.</li>
          <li>• Column-level checksums / hash totals on keys and monetary columns.</li>
          <li>• Aggregate comparisons for each migrated report (sums, distinct counts by business date).</li>
          <li>• Sampled record-level diffs for converted transformation logic.</li>
          <li>• CDC lag and gap monitoring during parallel run.</li>
          {validation?.findings.filter((f) => f.category === "migration").map((f) => <li key={f.id} className="text-text">• Open: {f.title}</li>)}
        </ul>
      </Section>
    </div>
  );
}

export function ArchitectView() {
  const { nodes, edges, name, validation, project } = useArch();
  const st = useStudio.getState();
  const byRole = (...roles: string[]) => nodes.filter((n) => roles.includes(n.data.tech?.role || ""));
  const envs = Array.from(new Set(nodes.map((n) => n.data.arch.environment || "Unspecified")));
  const groups: [string, string[]][] = [["Networking & connectivity", ["network"]], ["Identity & security", ["security"]], ["Governance & data quality", ["governance", "data-quality"]],
    ["Resilience (HA / DR)", ["resilience"]], ["Observability & delivery", ["observability", "devops"]]];
  const integration = edges.filter((e) => ["cdc", "streaming", "batch", "file"].includes(e.data?.arch.mode || ""));
  return (
    <div className="mx-auto max-w-[1100px] space-y-5 px-8 py-8">
      <div><div className="text-[12px] font-medium text-accent">Architect view</div><h2 className="text-[26px] font-semibold tracking-tight">Platform, security & integration</h2></div>
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map(([title, roles]) => (
          <Section key={title} title={title} icon={ShieldCheck}>
            <div className="flex flex-wrap gap-1.5">{byRole(...roles).map((n) => <Chip key={n.id} t={n.data.tech} label={n.data.arch.label || n.data.tech?.name || ""} />)}</div>
            {!byRole(...roles).length && <div className="text-[12.5px] text-bad">Not modelled — see validation findings.</div>}
          </Section>
        ))}
        <Section title="Platform boundaries" icon={Layers}>
          {envs.map((e) => <div key={e} className="mb-1.5 text-[12.5px]"><span className="font-medium">{e}:</span> <span className="text-muted">{nodes.filter((n) => (n.data.arch.environment || "Unspecified") === e).map((n) => n.data.tech?.name).join(", ")}</span></div>)}
        </Section>
      </div>
      <Section title="Integration & data flows" icon={ArrowRight}>
        <div className="space-y-1">{integration.map((e) => <div key={e.id} className="text-[12.5px]">{name(e.source)} <span className="text-faint">—{e.data?.arch.mode}→</span> {name(e.target)}</div>)}</div>
      </Section>
      {validation && <Section title="Architecture health" icon={ShieldCheck}><HealthPanel health={validation.health} /></Section>}
      <Section title="Architecture decisions" icon={FileText}>
        <div className="space-y-2">
          {project?.decisions.map((d) => (
            <button key={d.id} onClick={() => st.set({ adrDraft: d })} className="flex w-full items-start gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:border-border-strong">
              <span className="font-mono text-[12px] text-accent">ADR-{String(d.number).padStart(3, "0")}</span>
              <div className="flex-1"><div className="text-[13px] font-medium">{d.title}</div><div className="text-[12px] text-muted">{d.decision}</div></div>
              <Badge>{d.status}</Badge>
            </button>
          ))}
          {!project?.decisions.length && <div className="text-[12.5px] text-muted">No decisions recorded yet. Replace a component or right-click one to record an ADR.</div>}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" icon={Plus} onClick={() => st.set({ adrDraft: { title: "" } })}>New ADR</Button>
          {project && <a href={api.adrsUrl(project.id)} download={`${project.id}-adrs.md`}><Button size="sm" icon={Download}>Export ADRs</Button></a>}
        </div>
      </Section>
      <div className="text-[11.5px] text-faint">Strategies: {nodes.filter((n) => n.data.tech?.legacy).map((n) => `${n.data.tech?.name} → ${STRATEGY_NAMES[n.data.arch.strategy || n.data.arch.suggested_strategy || ""] || "unset"}`).join(" · ")}</div>
    </div>
  );
}
