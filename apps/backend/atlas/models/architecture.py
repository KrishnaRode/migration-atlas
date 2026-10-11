"""The architecture model shared by canvas, generator, validator, comparison and exports.

Coordinates are a UI concern: the backend never asks the model for positions. `position`
is stored only so saved projects reopen exactly as the user left them.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

from atlas.models.ontology import ConnectionStatus, EdgeKind

Origin = Literal["rules", "ai", "user", "pattern", "sample"]
Severity = Literal["critical", "high", "medium", "low", "info"]
SEVERITY_ORDER: dict[str, int] = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


def new_id(prefix: str = "n") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Position(BaseModel):
    x: float = 0
    y: float = 0


class ArchitectureNode(BaseModel):
    id: str = Field(default_factory=lambda: new_id("n"))
    tech_id: str
    label: str | None = None
    layer: str | None = None
    environment: str | None = None
    origin: Origin = "user"
    strategy: str | None = None  # one of the 8 R's — the user's call, AI may suggest
    suggested_strategy: str | None = None
    notes: str | None = None
    replaces: list[str] = Field(default_factory=list)  # tech ids this node takes over from
    group_id: str | None = None
    position: Position | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class ArchitectureEdge(BaseModel):
    id: str = Field(default_factory=lambda: new_id("e"))
    source: str
    target: str
    kind: EdgeKind = "data"
    label: str | None = None
    mode: str | None = None
    frequency: str | None = None
    format: str | None = None
    latency: str | None = None
    origin: Origin = "user"
    status: ConnectionStatus | None = None  # filled by connection intelligence


class ArchitectureRisk(BaseModel):
    title: str
    detail: str = ""
    severity: Severity = "medium"
    related_nodes: list[str] = Field(default_factory=list)
    source: Literal["rules", "ai", "ontology", "user"] = "rules"


class ArchitectureGroup(BaseModel):
    id: str = Field(default_factory=lambda: new_id("g"))
    label: str
    node_ids: list[str] = Field(default_factory=list)


class ArchitectureMeta(BaseModel):
    target_cloud: str | None = None
    data_platform: str | None = None
    generated_by: str | None = None  # "rules", "rules+ai:<model>", "pattern:<id>", "user"
    model: str | None = None
    parent_id: str | None = None  # set on what-if branches
    what_if: str | None = None
    migration_controls: list[str] = Field(default_factory=list)  # e.g. parallel-run, rollback-plan, cutover-plan
    ai_status: str | None = None  # human-readable note when AI was skipped or fell back
    label: str | None = None  # option letter (A, B, C…)
    variant: str | None = None  # requested | platform:<id> | coexistence | open | what-if
    summary: str | None = None  # one-line description of what makes this option different
    created_at: str = Field(default_factory=utcnow)


class Architecture(BaseModel):
    id: str = Field(default_factory=lambda: new_id("arch"))
    name: str = "Target architecture"
    description: str = ""
    nodes: list[ArchitectureNode] = Field(default_factory=list)
    edges: list[ArchitectureEdge] = Field(default_factory=list)
    groups: list[ArchitectureGroup] = Field(default_factory=list)
    architecture_notes: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    risks: list[ArchitectureRisk] = Field(default_factory=list)
    meta: ArchitectureMeta = Field(default_factory=ArchitectureMeta)

    def node(self, node_id: str) -> ArchitectureNode | None:
        return next((n for n in self.nodes if n.id == node_id), None)

    def nodes_by_tech(self, tech_id: str) -> list[ArchitectureNode]:
        return [n for n in self.nodes if n.tech_id == tech_id]


class ConnectionAssessment(BaseModel):
    status: ConnectionStatus
    reason: str
    suggestion: str | None = None
    kind: EdgeKind = "data"
    mode: str | None = None
    matched_rule: str | None = None  # e.g. "stage:silver -> role:bi"
    source_tech: str | None = None
    target_tech: str | None = None


# ----------------------------------------------------------------------- proposals


class OperationConnect(BaseModel):
    node: str  # an existing node id, or the temp id of a node added in the same proposal
    direction: Literal["from", "to"] = "from"  # "from": node -> new; "to": new -> node
    kind: EdgeKind | None = None
    mode: str | None = None
    label: str | None = None


class Operation(BaseModel):
    op: Literal["add_node", "remove_node", "replace_node", "add_edge", "remove_edge", "set_control", "set_strategy"]
    tech_id: str | None = None
    node_id: str | None = None  # target node, or temp id for add_node
    label: str | None = None
    layer: str | None = None
    connect: list[OperationConnect] = Field(default_factory=list)
    source: str | None = None
    target: str | None = None
    edge_id: str | None = None
    kind: EdgeKind | None = None
    mode: str | None = None
    value: str | None = None


class Proposal(BaseModel):
    id: str = Field(default_factory=lambda: new_id("p"))
    title: str
    reason: str
    source: Literal["rules", "ai"] = "rules"
    operations: list[Operation] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    finding_id: str | None = None
    confidence: Literal["high", "medium", "low"] = "medium"


# ----------------------------------------------------------------------- validation


class ValidationFinding(BaseModel):
    id: str
    rule_id: str
    category: Literal["data", "governance", "security", "reliability", "observability", "migration", "architecture"]
    severity: Severity
    title: str
    detail: str
    recommendation: str = ""
    node_ids: list[str] = Field(default_factory=list)
    edge_ids: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    proposal: Proposal | None = None


class HealthEvidence(BaseModel):
    check: str
    passed: bool
    detail: str


class HealthDimension(BaseModel):
    id: str
    name: str
    level: Literal["strong", "partial", "weak", "not-assessed"]
    passed: int
    applicable: int
    summary: str
    evidence: list[HealthEvidence] = Field(default_factory=list)


class ValidationReport(BaseModel):
    findings: list[ValidationFinding] = Field(default_factory=list)
    health: list[HealthDimension] = Field(default_factory=list)
    edge_status: dict[str, ConnectionAssessment] = Field(default_factory=dict)
    counts: dict[str, int] = Field(default_factory=dict)
