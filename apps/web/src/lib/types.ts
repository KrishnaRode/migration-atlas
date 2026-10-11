// Mirrors the backend Pydantic models (apps/backend/atlas/models). Keep in sync.

export type ConnectionStatus = "VALID" | "VALID_WITH_WARNING" | "UNUSUAL" | "INVALID" | "UNKNOWN";
export type EdgeKind = "data" | "control" | "governance" | "security" | "monitoring";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Persona = "developer" | "architect" | "leader";
export type Priority = "low" | "medium" | "high" | "critical";
export type Origin = "rules" | "ai" | "user" | "pattern" | "sample";

export interface Category { id: string; name: string; icon: string; color: string; count?: number }

export interface TechCard {
  id: string; name: string; vendor: string; category: string; role: string; layer: string; stage: string | null;
  legacy: boolean; environment: string; clouds: string[]; platforms: string[]; icon: string; color: string;
  description: string; capabilities: string[]; tags: string[]; operational_model: string; skills?: string[];
}

export interface DocLink { title: string; url: string }

export interface MigrationMapping {
  id: string; title: string; source: string; source_artifact: string | null; targets: string[];
  approaches: string[]; conversion_considerations: string[]; risks: string[];
  automation_potential: "low" | "medium" | "high"; manual_effort_areas: string[];
}

export interface RiskDef { id: string; title: string; description: string; category: string; mitigations: string[] }
export interface Strategy { id: string; name: string; summary: string; when_to_use: string[]; typical_effort: string; risk_level: string }
export interface ConstraintDef { id: string; name: string; keywords: string[]; effects: string[] }

export interface Citation { source_id: string; vendor: string; title: string; url: string; retrieved_at: string; doc_type: string; snippet?: string }
export interface SearchHit { chunk_id: string; document_id: string; text: string; score: number; citation: Citation; technologies: string[] }

export interface TechnologyDetail extends TechCard {
  aliases: string[]; typical_legacy_use: string; possible_targets: string[]; alternatives: string[]; replaces: string[];
  suggested_next: string[]; migration_considerations: string[]; known_challenges: string[]; risks: string[];
  strategies: string[]; skills: string[]; docs: DocLink[];
  category_info: Category | null;
  possible_targets_detail: TechCard[]; alternatives_detail: TechCard[]; replaces_detail: TechCard[];
  replaced_by: TechCard[]; suggested_next_detail: TechCard[]; related: TechCard[];
  mappings: MigrationMapping[]; patterns: { id: string; name: string; summary: string }[];
  risks_detail: RiskDef[]; strategies_detail: Strategy[]; knowledge: SearchHit[];
  graph: { direction: string; relation: string; id: string; kind: string; label: string }[];
}

export interface Position { x: number; y: number }

export interface ArchitectureNode {
  id: string; tech_id: string; label?: string | null; layer?: string | null; environment?: string | null;
  origin: Origin; strategy?: string | null; suggested_strategy?: string | null; notes?: string | null;
  replaces: string[]; group_id?: string | null; position?: Position | null; data?: Record<string, unknown>;
}

export interface ArchitectureEdge {
  id: string; source: string; target: string; kind: EdgeKind; label?: string | null; mode?: string | null;
  frequency?: string | null; format?: string | null; latency?: string | null; origin: Origin; status?: ConnectionStatus | null;
}

export interface ArchitectureRisk { title: string; detail: string; severity: Severity; related_nodes: string[]; source: string }
export interface ArchitectureGroup { id: string; label: string; node_ids: string[] }

export interface ArchitectureMeta {
  target_cloud?: string | null; data_platform?: string | null; generated_by?: string | null; model?: string | null;
  parent_id?: string | null; what_if?: string | null; migration_controls: string[]; ai_status?: string | null; created_at: string;
}

export interface Architecture {
  id: string; name: string; description: string; nodes: ArchitectureNode[]; edges: ArchitectureEdge[];
  groups: ArchitectureGroup[]; architecture_notes: string[]; assumptions: string[]; risks: ArchitectureRisk[];
  meta: ArchitectureMeta;
}

export interface ConnectionAssessment {
  status: ConnectionStatus; reason: string; suggestion?: string | null; kind: EdgeKind; mode?: string | null;
  matched_rule?: string | null; source_tech?: string | null; target_tech?: string | null;
}

export interface OperationConnect { node: string; direction: "from" | "to"; kind?: EdgeKind | null; mode?: string | null; label?: string | null }
export interface Operation {
  op: "add_node" | "remove_node" | "replace_node" | "add_edge" | "remove_edge" | "set_control" | "set_strategy";
  tech_id?: string | null; node_id?: string | null; label?: string | null; connect?: OperationConnect[];
  source?: string | null; target?: string | null; value?: string | null;
}
export interface Proposal {
  id: string; title: string; reason: string; source: "rules" | "ai"; operations: Operation[];
  evidence: string[]; finding_id?: string | null; confidence: "high" | "medium" | "low";
}

export interface ValidationFinding {
  id: string; rule_id: string; category: string; severity: Severity; title: string; detail: string;
  recommendation: string; node_ids: string[]; edge_ids: string[]; evidence: string[]; proposal?: Proposal | null;
}
export interface HealthEvidence { check: string; passed: boolean; detail: string }
export interface HealthDimension {
  id: string; name: string; level: "strong" | "partial" | "weak" | "not-assessed"; passed: number; applicable: number;
  summary: string; evidence: HealthEvidence[];
}
export interface ValidationReport {
  findings: ValidationFinding[]; health: HealthDimension[]; edge_status: Record<string, ConnectionAssessment>;
  counts: Partial<Record<Severity, number>>;
}

export interface MigrationConstraint { id: string; priority: Priority; note?: string | null }
export interface Estate {
  description: string; industry?: string | null; current_technologies: string[]; target_cloud?: string | null;
  target_platforms: string[]; constraints: MigrationConstraint[]; data_volume_tb?: number | null; notes: string[];
  retain_technologies: string[]; exclude_technologies: string[];
}

export interface WaveItem { title: string; detail: string; node_ids: string[] }
export interface MigrationWave {
  id: string; index: number; name: string; goal: string; activities: WaveItem[]; exit_criteria: string[];
  risks: string[]; depends_on: string[]; skills: string[]; included: boolean;
}
export interface DependencyNode { id: string; label: string; tech_id: string; kind: "legacy" | "target"; wave?: number | null }
export interface DependencyEdge { source: string; target: string; relation: "feeds" | "migrates_to" | "orchestrates" | "depends_on" }
export interface DependencyGraph { nodes: DependencyNode[]; edges: DependencyEdge[]; order: string[] }
export interface Roadmap {
  architecture_id: string; waves: MigrationWave[]; dependencies: DependencyGraph; themes: string[];
  narrative?: string | null; generated_at: string;
}

export interface ArchitectureDecision {
  id: string; number: number; title: string; status: "proposed" | "accepted" | "superseded" | "rejected";
  context: string; decision: string; alternatives: string[]; consequences: string[]; related_nodes: string[]; created_at: string;
}

export interface ChatMessage { role: "user" | "assistant" | "system"; content: string; persona?: Persona | null; citations: Citation[]; created_at: string }

export interface Project {
  id: string; name: string; description: string; industry?: string | null; estate: Estate; options: Architecture[];
  active_option_id?: string | null; roadmap?: Roadmap | null; risks: unknown[]; decisions: ArchitectureDecision[];
  knowledge_sources: string[]; conversations: ChatMessage[]; sample_id?: string | null; created_at: string; updated_at: string;
}

export interface ProjectSummary {
  id: string; name: string; description: string; industry?: string | null; current_technologies: string[];
  target: string[]; option_count: number; node_count: number; sample_id?: string | null; updated_at: string;
}

export interface Sample {
  id: string; title: string; subtitle: string; industry: string; featured: boolean; description: string;
  current: string[]; target: string[];
}

export interface Pattern {
  id: string; name: string; summary: string; description: string; suitable_scenarios: string[]; components: string[];
  benefits: string[]; limitations: string[]; tags: string[];
  template: { nodes: { key: string; tech: string; label?: string | null }[]; edges: { from: string; to: string; label?: string | null; kind?: EdgeKind }[] };
}

export interface PipelineStep { step: string; label: string; detail: string }

export interface KnowledgeSource {
  id: string; vendor: string; product: string; doc_type: string; enabled: boolean; base_url: string;
  allowed_prefixes: string[]; seed_urls: string[]; rate_limit_seconds: number; max_pages: number;
  respect_robots: boolean; technologies: string[]; terms_note: string; document_count: number; last_ingested_at?: string | null;
}
export interface KnowledgeDocument {
  id: string; source_id: string; vendor: string; product: string; url: string; title: string; doc_type: string;
  retrieved_at: string; version?: string | null; content_hash: string; technologies: string[]; chunk_count: number;
}

export interface OllamaStatus {
  reachable: boolean; base_url: string; version?: string | null;
  models: { name: string; size_gb: number; family?: string; parameters?: string; embedding: boolean }[];
  selected_model?: string | null; configured_model?: string | null; recommended: string[]; message: string;
  embedding_model?: string | null; setup: string[];
}

export interface CompareOption {
  id: string; name: string; target_cloud?: string | null; data_platform?: string | null; component_count: number;
  connection_count: number; components_by_layer: Record<string, string[]>; operational_model: Record<string, number>;
  rewrite_areas: { from: string; to: string; automation_potential: string; manual_effort: string[] }[];
  automation_mix: Record<string, number>; retained_legacy: string[]; governance_approach: string[]; skills_needed: string[];
  vendors: string[]; cloud_dependencies: string[]; complexity_drivers: string[]; risks: string[];
  validation: { counts: Partial<Record<Severity, number>>; top: string[] };
  health: { id: string; name: string; level: string; summary: string }[]; unique_components: string[];
}
export interface CompareResult { options: CompareOption[]; shared_components: string[]; narrative?: string | null }
