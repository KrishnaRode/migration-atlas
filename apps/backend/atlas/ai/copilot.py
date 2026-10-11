"""Architecture copilot: grounded, persona-aware streaming answers with citations.

Every architecture-specific question is answered with the architecture JSON (rendered compactly),
ontology facts for the selected component/connection, knowledge-graph neighbourhood, validation
findings and retrieved documentation in context.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from pydantic import BaseModel, Field

from atlas.ai.context import render_architecture, render_estate, render_findings, render_sources, render_tech_facts
from atlas.ai.ollama import OllamaClient
from atlas.ai.prompts import copilot_system
from atlas.knowledge.graph import NetworkXGraphStore
from atlas.knowledge.store import KnowledgeStore
from atlas.models.architecture import Architecture
from atlas.models.knowledge import SearchHit
from atlas.models.project import Estate
from atlas.ontology.service import OntologyService
from atlas.rules.connections import ConnectionEngine
from atlas.rules.validator import Validator


class ChatRequest(BaseModel):
    message: str
    persona: str = "architect"
    architecture: Architecture | None = None
    estate: Estate | None = None
    selected_node_id: str | None = None
    selected_edge_id: str | None = None
    history: list[dict] = Field(default_factory=list)  # [{role, content}]


class Copilot:
    def __init__(self, ontology: OntologyService, engine: ConnectionEngine, validator: Validator,
                 store: KnowledgeStore, graph: NetworkXGraphStore, ollama: OllamaClient):
        self.ontology = ontology
        self.engine = engine
        self.validator = validator
        self.store = store
        self.graph = graph
        self.ollama = ollama

    def focus(self, req: ChatRequest) -> tuple[str, list[str]]:
        """Facts about the selected element and the tech ids involved (for retrieval filters)."""
        arch = req.architecture
        if not arch:
            return "", []
        if req.selected_edge_id:
            edge = next((e for e in arch.edges if e.id == req.selected_edge_id), None)
            if edge:
                src, dst = arch.node(edge.source), arch.node(edge.target)
                if src and dst:
                    a = self.engine.assess_edge(arch, edge)
                    facts = [
                        f"SELECTED CONNECTION: {src.label or self.ontology.get(src.tech_id).name} -> "
                        f"{dst.label or self.ontology.get(dst.tech_id).name}",
                        f"Edge metadata: kind={edge.kind}, mode={edge.mode}, frequency={edge.frequency}, latency={edge.latency}, format={edge.format}",
                        f"Connection intelligence: {a.status} — {a.reason}" + (f" Suggestion: {a.suggestion}" if a.suggestion else ""),
                        render_tech_facts(src.tech_id, self.ontology),
                        render_tech_facts(dst.tech_id, self.ontology),
                    ]
                    return "\n".join(facts), [src.tech_id, dst.tech_id]
        if req.selected_node_id:
            node = arch.node(req.selected_node_id)
            if node:
                facts = [f"SELECTED COMPONENT: {node.label or node.tech_id}", render_tech_facts(node.tech_id, self.ontology)]
                g = self.graph.describe(node.tech_id)
                if g:
                    facts.append(f"Knowledge graph: {g}")
                ins = [arch.node(e.source) for e in arch.edges if e.target == node.id]
                outs = [arch.node(e.target) for e in arch.edges if e.source == node.id]
                facts.append("Upstream: " + ", ".join(n.label or n.tech_id for n in ins if n))
                facts.append("Downstream: " + ", ".join(n.label or n.tech_id for n in outs if n))
                return "\n".join(facts), [node.tech_id]
        return "", []

    def retrieve(self, req: ChatRequest, tech_ids: list[str]) -> list[SearchHit]:
        mentioned = [t for t, _, _ in self.ontology.match_aliases(req.message)]
        query = req.message + " " + " ".join(self.ontology.get(t).name for t in tech_ids + mentioned if self.ontology.get(t))
        hits = self.store.search(query, limit=4, technologies=list(dict.fromkeys(tech_ids + mentioned)) or None)
        if len(hits) < 2:
            hits += [h for h in self.store.search(query, limit=4) if h.chunk_id not in {x.chunk_id for x in hits}]
        unique, seen = [], set()
        for h in hits:
            if h.document_id not in seen:
                seen.add(h.document_id)
                unique.append(h)
        return unique[:4]

    def build_messages(self, req: ChatRequest) -> tuple[list[dict], list[SearchHit]]:
        focus, tech_ids = self.focus(req)
        hits = self.retrieve(req, tech_ids)
        context = []
        if req.architecture:
            context.append("ARCHITECTURE\n" + render_architecture(req.architecture, self.ontology))
            report = self.validator.validate(req.architecture, req.estate)
            context.append("VALIDATION FINDINGS\n" + render_findings(report))
        if req.estate:
            context.append("ESTATE\n" + render_estate(req.estate, self.ontology))
        if focus:
            context.append("ONTOLOGY FACTS\n" + focus)
        else:
            mentioned = [t for t, _, _ in self.ontology.match_aliases(req.message)][:3]
            if mentioned:
                context.append("ONTOLOGY FACTS\n" + "\n".join(render_tech_facts(t, self.ontology) for t in mentioned))
        context.append("SOURCES\n" + render_sources(hits))
        messages = [{"role": "system", "content": copilot_system(req.persona) + "\n\n" + "\n\n".join(context)}]
        for h in req.history[-6:]:
            if h.get("role") in {"user", "assistant"} and h.get("content"):
                messages.append({"role": h["role"], "content": str(h["content"])[:2000]})
        messages.append({"role": "user", "content": req.message})
        return messages, hits

    async def stream(self, req: ChatRequest) -> tuple[list[SearchHit], AsyncIterator[str]]:
        messages, hits = self.build_messages(req)
        return hits, self.ollama.chat_stream(messages)
