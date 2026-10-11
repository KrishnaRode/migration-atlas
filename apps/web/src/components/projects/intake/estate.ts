// Pure helpers for the estate intake screen.
import type { ParseResult } from "@/lib/api";
import type { Estate, Priority } from "@/lib/types";

export const EXAMPLE_TEXT =
  "Our current stack has Oracle, Informatica PowerCenter, Control-M, Tableau and around 300 TB of warehouse data. We want to move to GCP and Databricks while minimizing downtime.";

export const INDUSTRIES = ["Retail", "Banking", "Insurance", "Financial Services", "Healthcare", "Telecom", "Manufacturing", "Media", "Public Sector", "Energy", "Other"];

export const CURRENT_CATEGORIES = ["databases", "mainframe", "etl", "orchestration", "bi", "messaging", "streaming", "applications", "source-systems"];
/** Non-legacy technologies that still commonly appear in a current estate. */
export const CURRENT_EXTRAS = ["tableau", "power-bi", "apache-kafka", "apache-airflow", "postgresql", "mysql"];

export const CLOUDS = [
  { id: "gcp", name: "Google Cloud", short: "GCP" },
  { id: "aws", name: "AWS", short: "AWS" },
  { id: "azure", name: "Azure", short: "Azure" },
];
export const CLOUD_SHORT: Record<string, string> = { gcp: "GCP", aws: "AWS", azure: "Azure" };

export const PLATFORMS: { id: string; clouds: string[] }[] = [
  { id: "databricks", clouds: ["gcp", "aws", "azure"] },
  { id: "snowflake", clouds: ["gcp", "aws", "azure"] },
  { id: "bigquery", clouds: ["gcp"] },
  { id: "amazon-redshift", clouds: ["aws"] },
  { id: "azure-synapse", clouds: ["azure"] },
  { id: "microsoft-fabric", clouds: ["azure"] },
];
export const platformAvailable = (id: string, cloud?: string | null) =>
  !cloud || (PLATFORMS.find((p) => p.id === id)?.clouds.includes(cloud) ?? true);

export const PRIORITY_CYCLE: (Priority | null)[] = [null, "low", "medium", "high", "critical"];
export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };

export function emptyEstate(): Estate {
  return {
    description: "", industry: null, current_technologies: [], target_cloud: null, target_platforms: [],
    constraints: [], data_volume_tb: null, notes: [], retain_technologies: [], exclude_technologies: [],
  };
}

/** What the last text parse contributed, so a later parse can retract it without touching manual picks. */
export interface Contribution {
  current: string[]; platforms: string[]; cloud: string | null; constraints: string[];
  volume: number | null; industry: string | null;
}
export const emptyContribution = (): Contribution => ({ current: [], platforms: [], cloud: null, constraints: [], volume: null, industry: null });

const uniq = (xs: string[]) => Array.from(new Set(xs));

export function applyParse(estate: Estate, prev: Contribution, res: ParseResult, dismissed: Set<string>): { estate: Estate; contrib: Contribution } {
  const p = res.estate;
  const cur = (p.current_technologies || []).filter((id) => !dismissed.has(id));
  const plats = (p.target_platforms || []).filter((id) => !dismissed.has(id));
  const cloud = p.target_cloud && !dismissed.has(p.target_cloud) ? p.target_cloud : null;
  const cons = (p.constraints || []).filter((c) => !dismissed.has(`c:${c.id}`));

  const next: Estate = { ...estate };
  next.current_technologies = uniq([...estate.current_technologies.filter((id) => !prev.current.includes(id) || cur.includes(id)), ...cur]);
  if (estate.target_cloud == null || estate.target_cloud === prev.cloud) next.target_cloud = cloud;
  next.target_platforms = uniq([...estate.target_platforms.filter((id) => !prev.platforms.includes(id) || plats.includes(id)), ...plats])
    .filter((id) => platformAvailable(id, next.target_cloud));
  const keptCons = estate.constraints.filter((c) => !prev.constraints.includes(c.id) || cons.some((x) => x.id === c.id));
  next.constraints = [...keptCons, ...cons.filter((c) => !keptCons.some((k) => k.id === c.id)).map((c) => ({ id: c.id, priority: c.priority }))];
  const vol = p.data_volume_tb ?? null;
  if (estate.data_volume_tb == null || estate.data_volume_tb === prev.volume) next.data_volume_tb = vol;
  const ind = p.industry ?? null;
  if (ind && (!estate.industry || estate.industry === prev.industry)) next.industry = ind;

  return {
    estate: next,
    contrib: { current: cur, platforms: plats, cloud, constraints: cons.map((c) => c.id), volume: vol, industry: ind },
  };
}

export function targetsLabel(estate: Estate, name: (id: string) => string) {
  return [estate.target_cloud ? CLOUD_SHORT[estate.target_cloud] || name(estate.target_cloud) : null, ...estate.target_platforms.map(name)]
    .filter(Boolean).join(" + ");
}

export function suggestName(estate: Estate, name: (id: string) => string) {
  const t = targetsLabel(estate, name);
  return `${estate.industry && estate.industry !== "Other" ? `${estate.industry} ` : ""}Data Modernization${t ? ` on ${t}` : ""}`;
}

export function summaryLine(estate: Estate, name: (id: string) => string) {
  const parts: string[] = [];
  if (estate.current_technologies.length) parts.push(`${estate.current_technologies.length} current`);
  const t = targetsLabel(estate, name);
  if (t) parts.push(t);
  if (estate.constraints.length) parts.push(`${estate.constraints.length} requirement${estate.constraints.length === 1 ? "" : "s"}`);
  if (estate.data_volume_tb) parts.push(`${estate.data_volume_tb} TB`);
  return parts.join(" · ");
}
