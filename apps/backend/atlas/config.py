"""Runtime configuration. Everything has a local default; env vars override."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# apps/backend/atlas/config.py -> repo root is three levels up from this package.
REPO_ROOT = Path(__file__).resolve().parents[3]


def _env_path(name: str, default: Path) -> Path:
    value = os.environ.get(name)
    return Path(value).expanduser().resolve() if value else default


@dataclass(frozen=True)
class Settings:
    repo_root: Path = REPO_ROOT
    ontology_dir: Path = field(default_factory=lambda: _env_path("ATLAS_ONTOLOGY_DIR", REPO_ROOT / "ontology"))
    patterns_dir: Path = field(default_factory=lambda: _env_path("ATLAS_PATTERNS_DIR", REPO_ROOT / "patterns"))
    samples_dir: Path = field(default_factory=lambda: _env_path("ATLAS_SAMPLES_DIR", REPO_ROOT / "sample-estates"))
    knowledge_dir: Path = field(default_factory=lambda: _env_path("ATLAS_KNOWLEDGE_DIR", REPO_ROOT / "knowledge"))
    data_dir: Path = field(default_factory=lambda: _env_path("ATLAS_DATA_DIR", REPO_ROOT / "data"))
    ollama_base_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434"))
    ollama_model: str = field(default_factory=lambda: os.environ.get("ATLAS_MODEL", ""))
    # Small local models need generous timeouts for structured JSON; streaming chat is faster to first token.
    ollama_timeout_s: float = field(default_factory=lambda: float(os.environ.get("ATLAS_OLLAMA_TIMEOUT", "150")))
    ollama_retries: int = field(default_factory=lambda: int(os.environ.get("ATLAS_OLLAMA_RETRIES", "1")))
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip()
            for o in os.environ.get(
                "ATLAS_CORS_ORIGINS", "http://localhost:3014,http://127.0.0.1:3014,http://localhost:3000"
            ).split(",")
            if o.strip()
        )
    )

    @property
    def db_path(self) -> Path:
        return self.data_dir / "atlas.db"

    @property
    def graph_path(self) -> Path:
        return self.data_dir / "knowledge_graph.json"


# Models known to work well for structured output, in preference order. Discovery picks the
# first installed match; the user can override in Settings. Nothing is hardwired to one model.
RECOMMENDED_MODEL_PREFIXES = ("qwen3", "qwen2.5", "llama3.1", "llama3.2", "llama3", "mistral", "gemma3", "gemma2", "phi4")


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def override_settings(settings: Settings) -> None:
    """Used by tests to point the app at a temp data dir."""
    global _settings
    _settings = settings
