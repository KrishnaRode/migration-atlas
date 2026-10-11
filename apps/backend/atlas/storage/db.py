"""SQLite persistence: projects, settings and the knowledge store share one local file."""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path

from atlas.models.architecture import utcnow
from atlas.models.project import Project, ProjectSummary

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kb_documents (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL, vendor TEXT, product TEXT, url TEXT, title TEXT, doc_type TEXT,
  retrieved_at TEXT, version TEXT, content_hash TEXT, technologies TEXT, text TEXT
);
CREATE TABLE IF NOT EXISTS kb_chunks (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, ord INTEGER, text TEXT NOT NULL, embedding TEXT
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON kb_chunks(document_id);
CREATE TABLE IF NOT EXISTS kb_source_state (
  source_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, last_ingested_at TEXT
);
"""


class Database:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    def execute(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            cur = self._conn.execute(sql, params)
            rows = cur.fetchall()
            self._conn.commit()
            return rows

    def executemany(self, sql: str, rows: list[tuple]) -> None:
        with self._lock:
            self._conn.executemany(sql, rows)
            self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    # ------------------------------------------------------------------ settings
    def get_setting(self, key: str, default=None):
        rows = self.execute("SELECT value FROM settings WHERE key=?", (key,))
        return json.loads(rows[0]["value"]) if rows else default

    def set_setting(self, key: str, value) -> None:
        self.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                     (key, json.dumps(value)))


class ProjectRepository:
    def __init__(self, db: Database):
        self.db = db

    def list(self) -> list[ProjectSummary]:
        rows = self.db.execute("SELECT data FROM projects ORDER BY updated_at DESC")
        out = []
        for r in rows:
            p = Project.model_validate_json(r["data"])
            active = next((o for o in p.options if o.id == p.active_option_id), p.options[0] if p.options else None)
            out.append(ProjectSummary(
                id=p.id, name=p.name, description=p.description, industry=p.industry,
                current_technologies=p.estate.current_technologies,
                target=[x for x in [p.estate.target_cloud, *p.estate.target_platforms] if x],
                option_count=len(p.options), node_count=len(active.nodes) if active else 0,
                sample_id=p.sample_id, updated_at=p.updated_at,
            ))
        return out

    def get(self, project_id: str) -> Project | None:
        rows = self.db.execute("SELECT data FROM projects WHERE id=?", (project_id,))
        return Project.model_validate_json(rows[0]["data"]) if rows else None

    def save(self, project: Project) -> Project:
        project.updated_at = utcnow()
        self.db.execute(
            "INSERT INTO projects(id, name, data, created_at, updated_at) VALUES(?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET name=excluded.name, data=excluded.data, updated_at=excluded.updated_at",
            (project.id, project.name, project.model_dump_json(), project.created_at, project.updated_at),
        )
        return project

    def delete(self, project_id: str) -> bool:
        exists = self.get(project_id) is not None
        self.db.execute("DELETE FROM projects WHERE id=?", (project_id,))
        return exists
