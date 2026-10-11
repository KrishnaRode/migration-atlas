from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from atlas.config import Settings, override_settings
from atlas.models.project import Estate, MigrationConstraint
from atlas.ontology.loader import load_ontology
from atlas.ontology.service import OntologyService
from atlas.rules.connections import ConnectionEngine
from atlas.rules.validator import Validator

logging.disable(logging.WARNING)


@pytest.fixture(scope="session")
def ontology() -> OntologyService:
    s = Settings()
    return OntologyService(load_ontology(s.ontology_dir, s.patterns_dir))


@pytest.fixture(scope="session")
def engine(ontology) -> ConnectionEngine:
    return ConnectionEngine(ontology)


@pytest.fixture(scope="session")
def validator(ontology, engine) -> Validator:
    return Validator(ontology, engine)


@pytest.fixture
def retail_estate() -> Estate:
    return Estate(
        current_technologies=["oracle-database", "informatica-powercenter", "control-m", "tableau"],
        target_cloud="gcp",
        target_platforms=["databricks"],
        constraints=[MigrationConstraint(id="minimize-downtime", priority="high")],
        data_volume_tb=300,
    )


@pytest.fixture
def client(tmp_path, monkeypatch):
    """API client backed by a throwaway data dir; Ollama is pointed at a dead port so tests are
    deterministic and never depend on a local model."""
    from atlas import services

    override_settings(Settings(data_dir=tmp_path, ollama_base_url="http://127.0.0.1:9", ollama_timeout_s=2, ollama_retries=0))
    services.reset_services()
    from atlas.main import create_app

    with TestClient(create_app()) as c:
        yield c
    services.reset_services()
    override_settings(Settings())
