"""Architecture copilot: grounded, persona-aware streaming answers with citations.

Every architecture-specific question is answered with the architecture JSON (rendered compactly),
ontology facts for the selected component/connection, knowledge-graph neighbourhood, validation
findings and retrieved documentation in context.
"""

from __future__ import annotations

import re
from collections.abc import AsyncIterator

from pydantic import BaseModel, Field

from atlas.ai.context import render_architecture, render_estate, render_findings, render_sources, render_tech_facts
from atlas.ai.ollama import OllamaClient
from atlas.ai.prompts import copilot_system
from atlas.knowledge.graph import NetworkXGraphStore
from atlas.knowledge.skills import SkillLibrary
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
    options: list[Architecture] = Field(default_factory=list)  # all architecture options, for "which is best?"
    extra_context: str | None = None  # server-side context (fit tables, proposals) for routed intents


class Copilot:
    def __init__(self, ontology: OntologyService, engine: ConnectionEngine, validator: Validator,
                 store: KnowledgeStore, graph: NetworkXGraphStore, ollama: OllamaClient, skills: SkillLibrary | None = None):
        self.skills = skills
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
        mentioned = self.ontology.mentions(req.message)
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

    def playbooks(self, req: ChatRequest, focus_ids: list[str]):
        if not self.skills:
            return []
        arch_ids = [n.tech_id for n in req.architecture.nodes] if req.architecture else []
        estate_ids = list(req.estate.current_technologies) if req.estate else []
        return self.skills.select(req.message, tech_ids=arch_ids, focus_ids=focus_ids, estate_ids=estate_ids)

    def build_messages(self, req: ChatRequest) -> tuple[list[dict], list[SearchHit]]:
        focus, tech_ids = self.focus(req)
        hits = self.retrieve(req, tech_ids)
        self.last_playbooks = self.playbooks(req, tech_ids)
        context = []
        if req.architecture:
            context.append("Architecture\n" + render_architecture(req.architecture, self.ontology, compact=True))
            report = self.validator.validate(req.architecture, req.estate)
            context.append("Validation findings\n" + render_findings(report, limit=5))
        if req.estate:
            context.append("Estate\n" + render_estate(req.estate, self.ontology))
        if focus:
            context.append("Atlas ontology facts\n" + focus)
        else:
            mentioned = self.ontology.mentions(req.message)[:2]
            if mentioned:
                context.append("Atlas ontology facts\n" + "\n".join(render_tech_facts(t, self.ontology, brief=len(mentioned) > 1) for t in mentioned))
        if self.last_playbooks and self.skills:
            context.append("Expert playbook (apply when relevant)\n" + self.skills.render(self.last_playbooks, max_chars=3000))
        if req.extra_context:
            context.append("INSTRUCTIONS FOR THIS ANSWER (follow them; never repeat or mention them)\n" + req.extra_context)
        context.append("Sources\n" + render_sources(hits[:3], max_chars=480))
        messages = [{"role": "system", "content": copilot_system(req.persona) + "\n\n" + "\n\n".join(context)}]
        for h in req.history[-6:]:
            if h.get("role") in {"user", "assistant"} and h.get("content"):
                messages.append({"role": h["role"], "content": str(h["content"])[:2000]})
        messages.append({"role": "user", "content": f"Question: {req.message}\n\nWrite the answer now, starting with the direct answer."})
        return messages, hits[:3]

    last_playbooks: list = []

    async def stream(self, req: ChatRequest) -> tuple[list[SearchHit], AsyncIterator[str]]:
        messages, hits = self.build_messages(req)
        return hits, self._guarded(messages, req.message)

    async def _guarded(self, messages: list[dict], question: str) -> AsyncIterator[str]:
        """Stream the answer. Hold back the opening until it is clearly a real answer; if the model degenerates
        (echoes the question or says almost nothing), retry once in plain mode with a firmer instruction."""
        held, released = "", False
        q = question.strip().rstrip("?.!").lower()
        async for tok in strip_narration(self.ollama.chat_stream(messages)):
            if released:
                yield tok
                continue
            held += tok
            body = held.strip()
            if body.lower().startswith(q):  # drop a verbatim restatement of the question
                body = body[len(q):].lstrip("?.! \n")
            if len(body.split()) >= 40:
                released = True
                yield body
        if released:
            return
        body = held.strip()
        if body.lower().startswith(q):
            body = body[len(q):].lstrip("?.! \n")
        if len(body.split()) >= 15:
            yield body
            return
        retry = messages[:-1] + [{"role": "user", "content": f"Question: {question}\n\nAnswer it fully for THIS architecture in 120-250 words of "
                                  "Markdown. Your first sentence must be the direct answer. Do not repeat the question."}]
        async for tok in strip_narration(self.ollama.chat_stream(retry, temperature=0.5, envelope=False)):
            yield tok


_NARRATION = re.compile(
    r"^\s*(okay|ok|alright|hmm|first,|let me|let's|i need to|i will|i'll|i should|i must|the user|they want|looking at|"
    r"based on the (provided|given)|from the (architecture|ontology|sources|playbooks)|i notice|we need to)",
    re.I,
)


async def strip_narration(tokens: AsyncIterator[str], window: int = 900) -> AsyncIterator[str]:
    """Small models sometimes narrate ("The user wants… I need to…") before answering. Buffer the opening,
    drop leading paragraphs/sentences that talk about the user or the process, then stream normally."""
    buf = ""
    released = False
    async for tok in tokens:
        if released:
            yield tok
            continue
        buf += tok
        if len(buf) < window and "\n\n" not in buf[200:]:
            continue
        cleaned = _clean_opening(buf)
        released = True
        if cleaned:
            yield cleaned
    if not released and buf:
        yield _clean_opening(buf) or buf


def _strip_sentences(para: str) -> str:
    while True:
        m = re.match(r"\s*([^.!?\n]*[.!?:])(\s+|$)", para)
        if m and _NARRATION.match(m.group(1)):
            para = para[m.end():]
            continue
        return para


def _clean_opening(text: str) -> str:
    """Drop narrated sentences at the start of the answer; keep everything from the first real sentence on."""
    # Some answers open by restating the question as its own line ("Which option is the best fit for us?").
    text = re.sub(r"^\s*[^\n]{3,160}\?\s*\n+(?=\S)", "", text, count=1)
    paras = re.split(r"(\n\s*\n)", text)
    out, dropping = [], True
    for part in paras:
        if dropping:
            if not part.strip():
                continue
            rest = _strip_sentences(part) if _NARRATION.match(part) else part
            if not rest.strip():
                continue
            dropping = False
            out.append(rest.lstrip())
        else:
            out.append(part)
    return "".join(out)
