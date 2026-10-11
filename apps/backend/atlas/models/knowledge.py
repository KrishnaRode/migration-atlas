"""Knowledge-base models: source registry, documents, retrieval hits."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class KnowledgeSource(BaseModel):
    id: str
    vendor: str
    product: str = ""
    doc_type: str = "official-docs"
    enabled: bool = False
    base_url: str = ""
    allowed_prefixes: list[str] = Field(default_factory=list)
    seed_urls: list[str] = Field(default_factory=list)
    rate_limit_seconds: float = 2.0
    max_pages: int = 25
    respect_robots: bool = True
    technologies: list[str] = Field(default_factory=list)
    terms_note: str = ""
    document_count: int = 0
    last_ingested_at: str | None = None


class KnowledgeDocument(BaseModel):
    id: str
    source_id: str
    vendor: str
    product: str = ""
    url: str = ""
    title: str
    doc_type: str = "curated-note"
    retrieved_at: str
    version: str | None = None
    content_hash: str
    technologies: list[str] = Field(default_factory=list)
    chunk_count: int = 0


class Citation(BaseModel):
    source_id: str
    vendor: str
    title: str
    url: str
    retrieved_at: str
    doc_type: str


class SearchHit(BaseModel):
    chunk_id: str
    document_id: str
    text: str
    score: float
    citation: Citation
    technologies: list[str] = Field(default_factory=list)


class KnowledgeSearchRequest(BaseModel):
    query: str
    limit: int = 6
    vendor: str | None = None
    technologies: list[str] = Field(default_factory=list)
    doc_type: str | None = None


class IngestRequest(BaseModel):
    source_id: str | None = None
    urls: list[str] = Field(default_factory=list)  # must fall under a registered source's allowed prefixes
    max_pages: int | None = None


class IngestResult(BaseModel):
    source_id: str | None
    status: Literal["ok", "partial", "failed", "skipped"]
    ingested: list[str] = Field(default_factory=list)
    skipped: list[dict] = Field(default_factory=list)  # [{url, reason}]
    errors: list[dict] = Field(default_factory=list)
