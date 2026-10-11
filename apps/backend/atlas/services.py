"""Application service container. Built once at startup; injected into routers."""

from __future__ import annotations

import json
import logging
from functools import lru_cache

from atlas.ai.architect import ArchitectAI
from atlas.ai.copilot import Copilot
from atlas.ai.estate_parser import EstateParser
from atlas.ai.ollama import OllamaClient
from atlas.architecture.compare import ArchitectureComparer
from atlas.architecture.generator import ArchitectureGenerator
from atlas.config import Settings, get_settings
from atlas.knowledge.graph import NetworkXGraphStore
from atlas.knowledge.ingest import Ingestor, SourceRegistry
from atlas.knowledge.skills import SkillLibrary
from atlas.architecture.options import OptionPlanner
from atlas.knowledge.store import KnowledgeStore
from atlas.migration.roadmap import RoadmapPlanner
from atlas.models.project import Project
from atlas.ontology.loader import load_ontology
from atlas.ontology.service import OntologyService
from atlas.rules.connections import ConnectionEngine
from atlas.rules.validator import Validator
from atlas.storage.db import Database, ProjectRepository

log = logging.getLogger(__name__)


class Services:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.db = Database(settings.db_path)
        self.projects = ProjectRepository(self.db)
        self.reload_ontology()
        self.ollama = OllamaClient(
            base_url=self.db.get_setting("ollama_base_url", settings.ollama_base_url),
            model=self.db.get_setting("ollama_model", settings.ollama_model),
            timeout_s=settings.ollama_timeout_s,
            retries=settings.ollama_retries,
        )
        self.store = KnowledgeStore(self.db)
        self.registry = SourceRegistry(settings.knowledge_dir / "sources.yaml", self.db)
        self.ingestor = Ingestor(self.store, self.registry)
        seeded = self.ingestor.ingest_seed_dir(settings.knowledge_dir / "seed")
        if seeded:
            log.info("knowledge: loaded %s curated seed notes", seeded)
        self.graph = NetworkXGraphStore(settings.graph_path)
        self.rebuild_graph()
        self.skills = SkillLibrary(settings.knowledge_dir / "skills", self.ontology)
        self.estate_parser = EstateParser(self.ontology, self.ollama)
        self.architect_ai = ArchitectAI(self.ontology, self.engine, self.ollama, self.skills)
        self.copilot = Copilot(self.ontology, self.engine, self.validator, self.store, self.graph, self.ollama, self.skills)

    def reload_ontology(self) -> None:
        data = load_ontology(self.settings.ontology_dir, self.settings.patterns_dir)
        self.ontology = OntologyService(data)
        self.engine = ConnectionEngine(self.ontology)
        self.validator = Validator(self.ontology, self.engine)
        self.generator = ArchitectureGenerator(self.ontology, self.engine)
        self.planner = RoadmapPlanner(self.ontology)
        self.comparer = ArchitectureComparer(self.ontology, self.validator)
        self.options = OptionPlanner(self.ontology, self.generator, self.validator)

    def rebuild_graph(self) -> None:
        self.graph.rebuild(self.ontology, self.store.documents())

    def embedding_model(self) -> str | None:
        return self.db.get_setting("embedding_model", None)

    # ------------------------------------------------------------------ samples
    def samples(self) -> list[dict]:
        out = []
        for path in sorted(self.settings.samples_dir.glob("*.json")):
            try:
                out.append(json.loads(path.read_text(encoding="utf-8")))
            except ValueError:
                log.warning("bad sample estate file %s", path.name)
        return out

    def project_from_sample(self, sample_id: str) -> Project | None:
        sample = next((s for s in self.samples() if s.get("id") == sample_id), None)
        if not sample:
            return None
        project = Project.model_validate({**sample["project"], "sample_id": sample_id})
        return project


@lru_cache(maxsize=1)
def _services() -> Services:
    return Services(get_settings())


def get_services() -> Services:
    return _services()


def reset_services() -> None:
    _services.cache_clear()
