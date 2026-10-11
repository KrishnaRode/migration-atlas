"""Estate, migration planning and project models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from atlas.models.architecture import Architecture, new_id, utcnow

Priority = Literal["low", "medium", "high", "critical"]
Persona = Literal["developer", "architect", "leader"]
PRIORITY_WEIGHT: dict[str, int] = {"low": 1, "medium": 2, "high": 3, "critical": 4}


class MigrationConstraint(BaseModel):
    id: str  # an id from ontology/constraints.yaml
    priority: Priority = "medium"
    note: str | None = None


class Estate(BaseModel):
    description: str = ""
    industry: str | None = None
    current_technologies: list[str] = Field(default_factory=list)
    target_cloud: str | None = None  # gcp | aws | azure
    target_platforms: list[str] = Field(default_factory=list)  # technology ids, e.g. databricks
    constraints: list[MigrationConstraint] = Field(default_factory=list)
    data_volume_tb: float | None = None
    notes: list[str] = Field(default_factory=list)
    retain_technologies: list[str] = Field(default_factory=list)  # what-if: keep these legacy components
    exclude_technologies: list[str] = Field(default_factory=list)  # what-if: never pick these

    def constraint_priority(self, constraint_id: str) -> Priority | None:
        return next((c.priority for c in self.constraints if c.id == constraint_id), None)

    def has(self, constraint_id: str, at_least: Priority = "low") -> bool:
        p = self.constraint_priority(constraint_id)
        return p is not None and PRIORITY_WEIGHT[p] >= PRIORITY_WEIGHT[at_least]


class ParsedEstate(BaseModel):
    estate: Estate
    detected: list[dict] = Field(default_factory=list)  # [{tech_id, name, matched, role: current|target, source: rules|ai}]
    ai_used: bool = False
    ai_note: str | None = None


class MigrationRisk(BaseModel):
    id: str = Field(default_factory=lambda: new_id("r"))
    title: str
    detail: str = ""
    severity: Literal["critical", "high", "medium", "low", "info"] = "medium"
    mitigations: list[str] = Field(default_factory=list)
    related: list[str] = Field(default_factory=list)


class WaveItem(BaseModel):
    title: str
    detail: str = ""
    node_ids: list[str] = Field(default_factory=list)


class MigrationWave(BaseModel):
    id: str
    index: int
    name: str
    goal: str
    activities: list[WaveItem] = Field(default_factory=list)
    exit_criteria: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    included: bool = True


class DependencyNode(BaseModel):
    id: str
    label: str
    tech_id: str
    kind: Literal["legacy", "target"]
    wave: int | None = None


class DependencyEdge(BaseModel):
    source: str
    target: str
    relation: Literal["feeds", "migrates_to", "orchestrates", "depends_on"]


class DependencyGraph(BaseModel):
    nodes: list[DependencyNode] = Field(default_factory=list)
    edges: list[DependencyEdge] = Field(default_factory=list)
    order: list[str] = Field(default_factory=list)  # migration order of legacy node ids


class Roadmap(BaseModel):
    architecture_id: str
    waves: list[MigrationWave] = Field(default_factory=list)
    dependencies: DependencyGraph = Field(default_factory=DependencyGraph)
    themes: list[str] = Field(default_factory=list)
    narrative: str | None = None
    generated_at: str = Field(default_factory=utcnow)


class ArchitectureDecision(BaseModel):
    id: str = Field(default_factory=lambda: new_id("adr"))
    number: int = 0
    title: str
    status: Literal["proposed", "accepted", "superseded", "rejected"] = "proposed"
    context: str = ""
    decision: str = ""
    alternatives: list[str] = Field(default_factory=list)
    consequences: list[str] = Field(default_factory=list)
    related_nodes: list[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=utcnow)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    persona: Persona | None = None
    citations: list[dict] = Field(default_factory=list)
    created_at: str = Field(default_factory=utcnow)


class Project(BaseModel):
    id: str = Field(default_factory=lambda: new_id("proj"))
    name: str
    description: str = ""
    industry: str | None = None
    estate: Estate = Field(default_factory=Estate)
    options: list[Architecture] = Field(default_factory=list)  # architecture branches (Option A, B, ...)
    active_option_id: str | None = None
    roadmap: Roadmap | None = None
    option_analysis: dict | None = None  # priority-fit scores + recommendation across options
    risks: list[MigrationRisk] = Field(default_factory=list)
    decisions: list[ArchitectureDecision] = Field(default_factory=list)
    knowledge_sources: list[str] = Field(default_factory=list)
    conversations: list[ChatMessage] = Field(default_factory=list)
    sample_id: str | None = None
    created_at: str = Field(default_factory=utcnow)
    updated_at: str = Field(default_factory=utcnow)


class ProjectSummary(BaseModel):
    id: str
    name: str
    description: str
    industry: str | None
    current_technologies: list[str]
    target: list[str]
    option_count: int
    node_count: int
    sample_id: str | None
    updated_at: str


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    industry: str | None = None
    estate: Estate = Field(default_factory=Estate)
