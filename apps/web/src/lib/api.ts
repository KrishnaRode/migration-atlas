// Thin typed client for the local FastAPI backend. Never surfaces stack traces.
import type {
  Architecture, Category, Citation, CompareResult, ConnectionAssessment, Estate, KnowledgeDocument, KnowledgeSource,
  OllamaStatus, OptionAnalysis, Pattern, PipelineStep, Project, ProjectSummary, Proposal, Roadmap, Sample, SearchHit, TechCard,
  TechnologyDetail, ValidationReport, DependencyGraph, MigrationMapping, Strategy, ConstraintDef,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8014").replace(/\/$/, "");

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "error", status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit & { json?: unknown; raw?: boolean }): Promise<T> {
  const { json, raw, ...rest } = init || {};
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers || {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Can't reach the Migration Atlas backend. Is it running? (./start.sh starts everything)", "backend_unreachable");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    let code = "http_error";
    try {
      const body = await res.json();
      message = body?.error?.message || message;
      code = body?.error?.code || code;
    } catch { /* non-JSON error */ }
    throw new ApiError(message, code, res.status);
  }
  if (raw) return res as unknown as T;
  const ct = res.headers.get("content-type") || "";
  return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

export interface GenerateResult { architecture: Architecture; validation: ValidationReport; pipeline: PipelineStep[]; citations: Citation[] }
export interface ParseResult { estate: Estate; detected: { tech_id: string; name: string; matched: string | null; role: "current" | "target"; source: "rules" | "ai" }[]; ai_used: boolean; ai_note: string | null }
export interface ReplaceResult { architecture: Architecture; kept: unknown[]; dropped: { edge_id: string; assessment: ConnectionAssessment }[]; changes: string[]; validation: ValidationReport }
export interface WhatIfResult { architecture: Architecture; estate: Estate; changes: string[]; added: string[]; removed: string[]; validation: ValidationReport }

export const api = {
  health: () => request<{ status: string; ontology: Record<string, number>; knowledge: { documents: number }; ai: { reachable: boolean; model: string | null; message: string } }>("/health"),
  ollamaStatus: () => request<OllamaStatus>("/ollama/status"),
  updateSettings: (body: { ollama_base_url?: string; ollama_model?: string; embedding_model?: string }) =>
    request<OllamaStatus>("/settings", { method: "PUT", json: body }),
  testOllama: () => request<{ ok: boolean; model?: string; sample?: string; error?: string }>("/ollama/test", { method: "POST" }),

  categories: () => request<Category[]>("/categories"),
  technologies: (q = "", category?: string) =>
    request<TechCard[]>(`/technologies?q=${encodeURIComponent(q)}${category ? `&category=${category}` : ""}`),
  technology: (id: string) => request<TechnologyDetail>(`/technologies/${id}`),
  suggestions: (id: string, present: string[], cloud?: string | null) =>
    request<{ technology: TechCard; assessment: ConnectionAssessment }[]>(
      `/technologies/${id}/suggestions?present=${present.join(",")}${cloud ? `&cloud=${cloud}` : ""}`),
  replacements: (id: string, cloud?: string | null) =>
    request<(TechCard & { mapping: MigrationMapping | null; cloud_compatible: boolean })[]>(`/technologies/${id}/replacements${cloud ? `?cloud=${cloud}` : ""}`),
  assess: (source: string, target: string) => request<ConnectionAssessment>("/connections/assess", { method: "POST", json: { source, target } }),
  patterns: () => request<Pattern[]>("/patterns"),
  instantiatePattern: (id: string) => request<Architecture>(`/patterns/${id}/instantiate`, { method: "POST" }),
  strategies: () => request<Strategy[]>("/ontology/strategies"),
  constraints: () => request<ConstraintDef[]>("/ontology/constraints"),
  mappings: (source?: string) => request<MigrationMapping[]>(`/ontology/mappings${source ? `?source=${source}` : ""}`),
  search: (q: string) => request<{
    query: string; technologies: TechCard[]; mappings: MigrationMapping[]; patterns: { id: string; name: string; summary: string }[];
    knowledge: SearchHit[]; risks: { id: string; title: string; description: string; mitigations: string[] }[]; related: TechCard[];
    graph_path: { from_label: string; relation: string; to_label: string }[];
  }>(`/search?q=${encodeURIComponent(q)}`),

  parseEstate: (text: string, use_ai = true) => request<ParseResult>("/estate/parse", { method: "POST", json: { text, use_ai } }),
  generate: (estate: Estate, use_ai = true, name?: string) =>
    request<GenerateResult>("/architecture/generate", { method: "POST", json: { estate, use_ai, name } }),
  options: (estate: Estate, use_ai = true, count = 3) =>
    request<{ options: Architecture[]; analysis: OptionAnalysis; pipeline: PipelineStep[]; citations: Citation[] }>(
      "/architecture/options", { method: "POST", json: { estate, use_ai, count } }),
  analyseOptions: (options: Architecture[], estate: Estate, use_ai = false) =>
    request<OptionAnalysis>("/architecture/analyse-options", { method: "POST", json: { options, estate, use_ai } }),
  validate: (architecture: Architecture, estate?: Estate | null) =>
    request<ValidationReport>("/architecture/validate", { method: "POST", json: { architecture, estate } }),
  compare: (options: Architecture[], estate?: Estate | null, persona = "architect", narrative = false) =>
    request<CompareResult>("/architecture/compare", { method: "POST", json: { options, estate, persona, narrative } }),
  explain: (architecture: Architecture, target: { node_id?: string; edge_id?: string }) =>
    request<Record<string, unknown>>("/architecture/explain", { method: "POST", json: { architecture, ...target } }),
  replace: (architecture: Architecture, node_id: string, new_tech_id: string) =>
    request<ReplaceResult>("/architecture/replace-component", { method: "POST", json: { architecture, node_id, new_tech_id } }),
  applyProposal: (architecture: Architecture, proposal: Proposal, estate?: Estate | null) =>
    request<{ architecture: Architecture; validation: ValidationReport }>("/architecture/apply-proposal", { method: "POST", json: { architecture, proposal, estate } }),
  propose: (architecture: Architecture, estate: Estate | null, request_: string, use_ai = true) =>
    request<{ proposals: Proposal[]; ai_note: string | null }>("/architecture/propose", { method: "POST", json: { architecture, estate, request: request_, use_ai } }),
  whatIf: (architecture: Architecture, estate: Estate, question: string, use_ai = false) =>
    request<WhatIfResult>("/architecture/what-if", { method: "POST", json: { architecture, estate, question, use_ai } }),
  importArchitecture: (data: unknown) => request<{ architecture: Architecture; unknown_technologies: string[] }>("/architecture/import", { method: "POST", json: { data } }),

  roadmap: (architecture: Architecture, estate: Estate | null, persona = "leader", narrative = false) =>
    request<{ roadmap: Roadmap; migration_controls: string[] }>("/roadmap/generate", { method: "POST", json: { architecture, estate, persona, narrative } }),
  dependencies: (architecture: Architecture, estate: Estate | null) =>
    request<DependencyGraph>("/roadmap/dependencies", { method: "POST", json: { architecture, estate } }),

  samples: () => request<Sample[]>("/samples"),
  projects: () => request<ProjectSummary[]>("/projects"),
  project: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (body: { name: string; description?: string; industry?: string | null; estate: Estate }) =>
    request<Project>("/projects", { method: "POST", json: body }),
  fromSample: (id: string) => request<Project>(`/projects/from-sample/${id}`, { method: "POST" }),
  saveProject: (p: Project) => request<Project>(`/projects/${p.id}`, { method: "PUT", json: p }),
  deleteProject: (id: string) => request<{ deleted: string }>(`/projects/${id}`, { method: "DELETE" }),
  importProject: (data: unknown) => request<Project>("/projects/import", { method: "POST", json: { data } }),

  exportMarkdown: (project: Project, option_id: string | null, diagram_png?: string) =>
    request<string>("/export/markdown", { method: "POST", json: { project, option_id, diagram_png } }),
  exportPdf: (project: Project, option_id: string | null, diagram_png?: string) =>
    request<Response>("/export/pdf", { method: "POST", json: { project, option_id, diagram_png }, raw: true }),
  adrsUrl: (projectId: string) => `${API_URL}/projects/${projectId}/adrs.md`,

  knowledgeSearch: (query: string, opts: { vendor?: string; technologies?: string[]; limit?: number } = {}) =>
    request<{ hits: SearchHit[]; mode: string }>("/knowledge/search", { method: "POST", json: { query, ...opts } }),
  sources: () => request<KnowledgeSource[]>("/knowledge/sources"),
  toggleSource: (id: string, enabled: boolean) => request<KnowledgeSource>(`/knowledge/sources/${id}`, { method: "PUT", json: { enabled } }),
  ingest: (body: { source_id?: string; urls?: string[]; max_pages?: number }) =>
    request<{ results: { source_id: string | null; status: string; ingested: string[]; skipped: { url: string; reason: string }[]; errors: { url: string; reason: string }[] }[]; documents: number }>(
      "/knowledge/ingest", { method: "POST", json: body }),
  upload: (file: File, vendor = "Local") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("vendor", vendor);
    return request<KnowledgeDocument>("/knowledge/upload", { method: "POST", body: fd });
  },
  documents: () => request<KnowledgeDocument[]>("/knowledge/documents"),
  deleteDocument: (id: string) => request<{ deleted: string }>(`/knowledge/documents/${encodeURIComponent(id)}`, { method: "DELETE" }),
  graphStats: () => request<{ nodes: number; edges: number; node_kinds: Record<string, number>; relations: Record<string, number> }>("/knowledge/graph/stats"),
};

export type ChatAction =
  | { type: "proposals"; proposals: import("./types").Proposal[]; note?: string | null }
  | { type: "what_if"; question: string; changes: string[] }
  | { type: "fit"; analysis: OptionAnalysis }
  | { type: "no_change"; note?: string | null };

export interface ChatStreamHandlers {
  onMeta?: (meta: { model: string | null; citations: Citation[]; playbooks?: { id: string; title: string }[] }) => void;
  onIntent?: (intent: string) => void;
  onAction?: (action: ChatAction) => void;
  onToken: (token: string) => void;
  onDone?: () => void;
  onError?: (err: { code: string; message: string }) => void;
}

/** Stream a copilot answer over SSE (POST, so fetch + manual parsing rather than EventSource). */
export async function streamChat(body: unknown, h: ChatStreamHandlers, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/ai/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    h.onError?.({ code: "backend_unreachable", message: "Can't reach the Migration Atlas backend." });
    return;
  }
  if (!res.ok || !res.body) {
    h.onError?.({ code: "http_error", message: `The copilot request failed (${res.status}).` });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const event = /^event: (.*)$/m.exec(raw)?.[1];
        const data = /^data: (.*)$/m.exec(raw)?.[1];
        if (!event || data === undefined) continue;
        const parsed = JSON.parse(data);
        if (event === "meta") h.onMeta?.(parsed);
        else if (event === "intent") h.onIntent?.(parsed.intent);
        else if (event === "action") h.onAction?.(parsed);
        else if (event === "token") h.onToken(parsed);
        else if (event === "done") h.onDone?.();
        else if (event === "error") h.onError?.(parsed);
      }
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") h.onError?.({ code: "stream", message: "The answer stream was interrupted." });
  }
}
