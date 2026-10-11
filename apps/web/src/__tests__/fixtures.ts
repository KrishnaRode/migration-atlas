import type { Architecture, TechCard } from "@/lib/types";

export const tech = (id: string, patch: Partial<TechCard> = {}): TechCard => ({
  id, name: id, vendor: "Vendor", category: "databases", role: "source-database", layer: "sources", stage: null, legacy: false,
  environment: "cloud", clouds: ["gcp"], platforms: [], icon: "database", color: "#2f6bff", description: `${id} description`,
  capabilities: ["sql"], tags: [], operational_model: "managed", ...patch,
});

export const TECHS: Record<string, TechCard> = {
  oracle: tech("oracle", { name: "Oracle Database", legacy: true, environment: "on-prem" }),
  cdc: tech("cdc", { name: "Lakeflow Connect", role: "cdc", layer: "ingestion", category: "cdc" }),
  landing: tech("landing", { name: "Landing", role: "lake-layer", layer: "storage", stage: "landing", category: "data-lake" }),
  bronze: tech("bronze", { name: "Bronze", role: "lake-layer", layer: "storage", stage: "bronze", category: "data-lake" }),
  silver: tech("silver", { name: "Silver", role: "lake-layer", layer: "storage", stage: "silver", category: "data-lake" }),
  sql: tech("sql", { name: "Databricks SQL", role: "serving", layer: "serving", category: "data-warehouse" }),
  bi: tech("bi", { name: "Tableau", role: "bi", layer: "consumption", category: "bi" }),
  uc: tech("uc", { name: "Unity Catalog", role: "governance", layer: "governance", category: "governance" }),
  dbx: tech("dbx", { name: "Databricks", role: "lakehouse", layer: "processing", category: "data-platforms" }),
};

const node = (id: string, tech_id: string) => ({ id, tech_id, origin: "rules" as const, replaces: [] });
const edge = (source: string, target: string, kind: "data" | "governance" = "data") =>
  ({ id: `${source}-${target}`, source, target, kind, origin: "rules" as const });

export const ARCH: Architecture = {
  id: "a1", name: "Test", description: "", groups: [], architecture_notes: [], assumptions: [], risks: [],
  meta: { migration_controls: [], created_at: "2026-01-01" },
  nodes: [node("o", "oracle"), node("c", "cdc"), node("l", "landing"), node("b", "bronze"), node("s", "silver"),
    node("q", "sql"), node("t", "bi"), node("u", "uc"), node("d", "dbx")],
  edges: [edge("o", "c"), edge("c", "l"), edge("l", "b"), edge("b", "s"), edge("s", "q"), edge("q", "t"), edge("u", "q", "governance")],
};
