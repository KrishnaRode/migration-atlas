"""Ontology entities, loaded from YAML under ontology/ and patterns/."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ConnectionStatus = Literal["VALID", "VALID_WITH_WARNING", "UNUSUAL", "INVALID", "UNKNOWN"]
EdgeKind = Literal["data", "control", "governance", "security", "monitoring"]

LAYERS: tuple[str, ...] = (
    "sources",
    "ingestion",
    "storage",
    "processing",
    "serving",
    "consumption",
    "governance",
    "security",
    "operations",
)
DATA_LAYERS: tuple[str, ...] = LAYERS[:6]


class DocLink(BaseModel):
    title: str
    url: str


class Category(BaseModel):
    id: str
    name: str
    icon: str = "box"
    color: str = "#64748B"


class Technology(BaseModel):
    id: str
    name: str
    vendor: str
    category: str
    role: str
    layer: str
    description: str
    capabilities: list[str] = Field(default_factory=list)
    aliases: list[str] = Field(default_factory=list)
    environment: str = "any"
    legacy: bool = False
    clouds: list[str] = Field(default_factory=list)
    stage: str | None = None
    platforms: list[str] = Field(default_factory=list)
    operational_model: str = "self-managed"
    icon: str = "box"
    color: str = "#64748B"
    typical_legacy_use: str = ""
    possible_targets: list[str] = Field(default_factory=list)
    alternatives: list[str] = Field(default_factory=list)
    replaces: list[str] = Field(default_factory=list)
    suggested_next: list[str] = Field(default_factory=list)
    migration_considerations: list[str] = Field(default_factory=list)
    known_challenges: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    strategies: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    docs: list[DocLink] = Field(default_factory=list)

    def runs_on(self, cloud: str | None) -> bool:
        """True when this technology can run in `cloud` (or we cannot tell)."""
        if not cloud or not self.clouds:
            return True
        return cloud in self.clouds or "any" in self.clouds


class ConnectionRule(BaseModel):
    from_: str = Field(alias="from")
    to: str
    status: ConnectionStatus
    reason: str
    suggestion: str | None = None
    kind: EdgeKind = "data"
    mode: str | None = None

    model_config = {"populate_by_name": True}


class TemplateNode(BaseModel):
    key: str
    tech: str
    label: str | None = None


class TemplateEdge(BaseModel):
    from_: str = Field(alias="from")
    to: str
    label: str | None = None
    mode: str | None = None
    frequency: str | None = None
    latency: str | None = None
    format: str | None = None
    kind: EdgeKind = "data"

    model_config = {"populate_by_name": True}


class PatternTemplate(BaseModel):
    nodes: list[TemplateNode] = Field(default_factory=list)
    edges: list[TemplateEdge] = Field(default_factory=list)


class Pattern(BaseModel):
    id: str
    name: str
    summary: str = ""
    description: str = ""
    suitable_scenarios: list[str] = Field(default_factory=list)
    components: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    template: PatternTemplate = Field(default_factory=PatternTemplate)


class MigrationMapping(BaseModel):
    id: str
    title: str = ""
    source: str
    source_artifact: str | None = None
    targets: list[str] = Field(default_factory=list)
    approaches: list[str] = Field(default_factory=list)
    conversion_considerations: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    automation_potential: Literal["low", "medium", "high"] = "medium"
    manual_effort_areas: list[str] = Field(default_factory=list)


class RiskDef(BaseModel):
    id: str
    title: str
    description: str = ""
    category: str = "migration"
    likelihood_drivers: list[str] = Field(default_factory=list)
    mitigations: list[str] = Field(default_factory=list)
    applies_to: list[str] = Field(default_factory=list)


class Strategy(BaseModel):
    id: str
    name: str
    summary: str = ""
    when_to_use: list[str] = Field(default_factory=list)
    typical_effort: str = "medium"
    risk_level: str = "medium"
    examples: list[str] = Field(default_factory=list)


class ConstraintDef(BaseModel):
    id: str
    name: str
    keywords: list[str] = Field(default_factory=list)
    effects: list[str] = Field(default_factory=list)


class CloudBlocks(BaseModel):
    """A cloud's building blocks; values are technology ids (see ontology/platforms.yaml)."""

    name: str
    tech: str
    model_config = {"extra": "allow"}

    def get(self, key: str) -> str | None:
        value = getattr(self, key, None)
        if isinstance(value, list):
            return value[0] if value else None
        return value

    def get_list(self, key: str) -> list[str]:
        value = getattr(self, key, None)
        if value is None:
            return []
        return list(value) if isinstance(value, list) else [value]


class DataPlatformBlocks(CloudBlocks):
    clouds: list[str] = Field(default_factory=list)
    kind: Literal["lakehouse", "warehouse"] = "warehouse"
    zones: list[str] = Field(default_factory=list)


class Platforms(BaseModel):
    clouds: dict[str, CloudBlocks] = Field(default_factory=dict)
    data_platforms: dict[str, DataPlatformBlocks] = Field(default_factory=dict)
    default_data_platform: dict[str, str] = Field(default_factory=dict)
