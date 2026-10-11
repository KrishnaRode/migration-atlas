"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { memo } from "react";
import { TechIcon } from "@/components/ui";
import type { TechFlowNode } from "@/lib/studio-store";
import { cn, SEVERITY_COLOR, STRATEGY_NAMES } from "@/lib/utils";

const SIDES = [
  { id: "l", pos: Position.Left },
  { id: "r", pos: Position.Right },
  { id: "t", pos: Position.Top },
  { id: "b", pos: Position.Bottom },
];

function TechNodeImpl({ data, selected }: NodeProps<TechFlowNode>) {
  const { arch, tech, severity, findingCount, delay, highlight } = data;
  const legacy = !!tech?.legacy;
  const name = arch.label || tech?.name || arch.tech_id;
  const strategy = arch.strategy || arch.suggested_strategy;
  const env = arch.environment;
  return (
    <div
      className={cn(
        "group relative flex h-[76px] w-[236px] items-center gap-3 rounded-[14px] border bg-surface px-3 transition-[box-shadow,border-color,transform] duration-200 animate-pop",
        selected ? "border-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent),var(--shadow-lg)]" : "border-border shadow-soft hover:border-border-strong hover:shadow-lift",
        legacy && !selected && "border-dashed",
        highlight && "[animation:pop_0.45s_both,pulse-ring_1.4s_ease-out_3]",
      )}
      style={{ animationDelay: `${delay || 0}ms` }}
      title={tech?.description}
    >
      {SIDES.map((s) => (
        <Handle key={s.id} id={s.id} type="source" position={s.pos} />
      ))}
      {/* Category accent rail */}
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: legacy ? "var(--legacy)" : tech?.color || "var(--accent)", opacity: 0.85 }} />
      <TechIcon icon={tech?.icon} color={tech?.color} size={38} muted={legacy} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <div className="truncate text-[13px] font-semibold leading-tight tracking-[-0.005em]">{name}</div>
          {arch.origin === "ai" && <Sparkles size={11} className="shrink-0 text-accent" aria-label="Added by local AI" />}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-faint">
          {tech ? `${categoryLabel(tech.category)} · ${tech.vendor}` : "Unknown technology"}
        </div>
        <div className="mt-1 flex items-center gap-1 overflow-hidden">
          {env && (
            <span className={cn("rounded-[5px] px-1.5 text-[10px] font-medium leading-[16px]", legacy ? "bg-surface-2 text-muted" : "bg-modern-soft text-modern")}>{env}</span>
          )}
          {strategy && (
            <span className="truncate rounded-[5px] bg-accent-soft px-1.5 text-[10px] font-medium leading-[16px] text-accent" title={arch.strategy ? "Strategy set by you" : "Suggested strategy"}>
              {STRATEGY_NAMES[strategy] || strategy}{!arch.strategy && "?"}
            </span>
          )}
        </div>
      </div>
      {severity && (
        <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-[var(--canvas)]"
          style={{ background: SEVERITY_COLOR[severity] }} title={`${findingCount} validation finding(s)`}>
          {findingCount}
        </span>
      )}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  "source-systems": "Source system", databases: "Database", mainframe: "Mainframe", applications: "Application", etl: "ETL",
  cdc: "CDC", messaging: "Messaging", streaming: "Streaming", storage: "Storage", "data-lake": "Data lake",
  "data-platforms": "Data platform", "data-warehouse": "Warehouse", processing: "Processing", orchestration: "Orchestration",
  governance: "Governance", "data-quality": "Data quality", security: "Security", observability: "Observability", bi: "BI",
  apis: "API", containers: "Containers", "ai-ml": "AI / ML", devops: "DevOps", "cloud-networking": "Networking",
  "cloud-platforms": "Cloud", reliability: "Reliability",
};
export const categoryLabel = (c: string) => CATEGORY_LABELS[c] || c;

export const TechNode = memo(TechNodeImpl);
