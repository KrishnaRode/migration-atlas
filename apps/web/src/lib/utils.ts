import clsx, { type ClassValue } from "clsx";
import type { ConnectionStatus, Severity } from "./types";

export const cn = (...v: ClassValue[]) => clsx(v);

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "var(--bad)", high: "var(--bad)", medium: "var(--warn)", low: "var(--info)", info: "var(--faint)",
};
export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export const STATUS_META: Record<ConnectionStatus, { label: string; color: string }> = {
  VALID: { label: "Valid", color: "var(--ok)" },
  VALID_WITH_WARNING: { label: "Valid with warning", color: "var(--warn)" },
  UNUSUAL: { label: "Unusual", color: "var(--unusual)" },
  INVALID: { label: "Invalid", color: "var(--bad)" },
  UNKNOWN: { label: "Unknown", color: "var(--faint)" },
};

export const CLOUD_NAMES: Record<string, string> = { gcp: "Google Cloud", aws: "AWS", azure: "Azure" };

export const STRATEGY_NAMES: Record<string, string> = {
  retain: "Retain", retire: "Retire", rehost: "Rehost", relocate: "Relocate", repurchase: "Repurchase",
  replatform: "Replatform", refactor: "Refactor", rearchitect: "Rearchitect",
};

export const LAYER_NAMES: Record<string, string> = {
  sources: "Sources", ingestion: "Ingestion", storage: "Storage", processing: "Processing", serving: "Serving",
  consumption: "Consumption", governance: "Governance", security: "Security", operations: "Operations",
};
export const DATA_LAYERS = ["sources", "ingestion", "storage", "processing", "serving", "consumption"];
export const CROSS_LAYERS = ["governance", "security", "operations"];

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.max(1, Math.round((Date.now() - d) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function download(filename: string, content: Blob | string, type = "application/octet-stream") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "migration-atlas";

export const uid = (p = "n") => `${p}_${Math.random().toString(36).slice(2, 10)}`;
