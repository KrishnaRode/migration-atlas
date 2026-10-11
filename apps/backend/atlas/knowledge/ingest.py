"""Controlled documentation ingestion.

Only sources declared in knowledge/sources.yaml can be fetched, only URLs under their
`allowed_prefixes`, only when the user has enabled the source, honouring robots.txt and a
per-source rate limit. There is no link-following crawler: ingestion fetches the configured seed
pages (or URLs the user names that fall inside an allowed prefix) and stops at `max_pages`.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import logging
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib import robotparser
from urllib.parse import urlparse

import httpx
import yaml

from atlas.models.architecture import utcnow
from atlas.models.knowledge import IngestResult, KnowledgeDocument, KnowledgeSource
from atlas.knowledge.store import KnowledgeStore, content_hash
from atlas.storage.db import Database

log = logging.getLogger(__name__)
USER_AGENT = "MigrationAtlas/0.1 (+local documentation ingestion; respects robots.txt)"
SKIP_TAGS = {"script", "style", "nav", "header", "footer", "aside", "noscript", "svg", "form", "button"}
BLOCK_TAGS = {"p", "div", "section", "article", "li", "tr", "br", "pre", "table", "ul", "ol", "dd", "dt"}
VERSION_RX = re.compile(r"\b(?:version|release|v)\s?(\d+(?:\.\d+){0,2})\b", re.I)


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.title = ""
        self._skip = 0
        self._in_title = False
        self._heading: str | None = None

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self._skip += 1
        elif tag == "title":
            self._in_title = True
        elif tag in {"h1", "h2", "h3", "h4"}:
            self._heading = tag
            self.parts.append("\n\n" + "#" * int(tag[1]) + " ")
        elif tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS and self._skip:
            self._skip -= 1
        elif tag == "title":
            self._in_title = False
        elif tag in {"h1", "h2", "h3", "h4"}:
            self.parts.append("\n\n")
        elif tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self._skip:
            self.parts.append(data)


def html_to_text(html: str) -> tuple[str, str]:
    p = _TextExtractor()
    p.feed(html)
    text = "".join(p.parts)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return p.title.strip(), text.strip()


def pdf_to_text(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n\n".join((page.extract_text() or "") for page in reader.pages)


def parse_front_matter(text: str) -> tuple[dict, str]:
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end > 0:
            meta = yaml.safe_load(text[3:end]) or {}
            return meta, text[end + 4 :].lstrip()
    return {}, text


def doc_id_for(source_id: str, key: str) -> str:
    return f"{source_id}:{hashlib.sha1(key.encode()).hexdigest()[:12]}"


class SourceRegistry:
    def __init__(self, path: Path, db: Database):
        self.path = path
        self.db = db

    def load(self) -> list[KnowledgeSource]:
        raw = yaml.safe_load(self.path.read_text(encoding="utf-8")) if self.path.exists() else []
        state = {r["source_id"]: r for r in self.db.execute("SELECT * FROM kb_source_state")}
        counts = {r["source_id"]: r["n"] for r in self.db.execute("SELECT source_id, COUNT(*) n FROM kb_documents GROUP BY source_id")}
        out = []
        for item in raw or []:
            src = KnowledgeSource.model_validate(item)
            if src.id in state:
                src.enabled = bool(state[src.id]["enabled"])
                src.last_ingested_at = state[src.id]["last_ingested_at"]
            src.document_count = counts.get(src.id, 0)
            out.append(src)
        return out

    def get(self, source_id: str) -> KnowledgeSource | None:
        return next((s for s in self.load() if s.id == source_id), None)

    def set_enabled(self, source_id: str, enabled: bool) -> None:
        self.db.execute(
            "INSERT INTO kb_source_state(source_id, enabled) VALUES(?, ?) ON CONFLICT(source_id) DO UPDATE SET enabled=excluded.enabled",
            (source_id, int(enabled)),
        )

    def mark_ingested(self, source_id: str) -> None:
        self.db.execute(
            "INSERT INTO kb_source_state(source_id, enabled, last_ingested_at) VALUES(?, 1, ?) "
            "ON CONFLICT(source_id) DO UPDATE SET last_ingested_at=excluded.last_ingested_at",
            (source_id, utcnow()),
        )

    def source_for_url(self, url: str) -> KnowledgeSource | None:
        return next((s for s in self.load() if any(url.startswith(p) for p in s.allowed_prefixes)), None)


class Ingestor:
    def __init__(self, store: KnowledgeStore, registry: SourceRegistry, fetch_timeout: float = 20.0):
        self.store = store
        self.registry = registry
        self.fetch_timeout = fetch_timeout
        self._robots: dict[str, robotparser.RobotFileParser | None] = {}
        self._last_fetch: dict[str, float] = {}

    # ------------------------------------------------------------------ seed + local
    def ingest_seed_dir(self, seed_dir: Path) -> int:
        """Load the curated notes that ship with the repo. Idempotent via content hash."""
        added = 0
        for path in sorted(seed_dir.glob("*.md")):
            raw = path.read_text(encoding="utf-8")
            meta, body = parse_front_matter(raw)
            h = content_hash(raw)
            if self.store.has_hash(h):
                continue
            doc = KnowledgeDocument(
                id=doc_id_for("seed", path.name), source_id="seed", vendor=meta.get("vendor", "Migration Atlas"),
                product=meta.get("product", ""), url=meta.get("url", ""), title=meta.get("title", path.stem),
                doc_type=meta.get("doc_type", "curated-note"), retrieved_at=utcnow(), version=meta.get("version"),
                content_hash=h, technologies=list(meta.get("technologies") or []),
            )
            self.store.upsert_document(doc, f"# {doc.title}\n\n{body}", reload=False)
            added += 1
        if added:
            self.store.reload()
        return added

    def ingest_upload(self, filename: str, data: bytes, vendor: str = "Local", technologies: list[str] | None = None) -> KnowledgeDocument:
        suffix = Path(filename).suffix.lower()
        if suffix == ".pdf":
            text, title = pdf_to_text(data), Path(filename).stem
        elif suffix in {".html", ".htm"}:
            title, text = html_to_text(data.decode("utf-8", errors="replace"))
            title = title or Path(filename).stem
        elif suffix in {".md", ".markdown", ".txt", ".rst"}:
            meta, text = parse_front_matter(data.decode("utf-8", errors="replace"))
            title = meta.get("title") or Path(filename).stem
            vendor = meta.get("vendor", vendor)
            technologies = technologies or meta.get("technologies") or []
        else:
            raise ValueError(f"Unsupported file type '{suffix}'. Use PDF, HTML, Markdown or text.")
        if len(text.strip()) < 40:
            raise ValueError("No readable text could be extracted from this file.")
        doc = KnowledgeDocument(
            id=doc_id_for("local", filename + content_hash(text)[:8]), source_id="local", vendor=vendor,
            title=title.replace("_", " ").replace("-", " ").strip() or filename, url=f"local://{filename}",
            doc_type="local-upload", retrieved_at=utcnow(), version=self._version(text), content_hash=content_hash(text),
            technologies=technologies or [],
        )
        self.store.upsert_document(doc, text)
        return doc

    # ------------------------------------------------------------------ web
    def _allowed_by_robots(self, url: str) -> bool:
        parsed = urlparse(url)
        root = f"{parsed.scheme}://{parsed.netloc}"
        if root not in self._robots:
            rp = robotparser.RobotFileParser()
            try:
                r = httpx.get(f"{root}/robots.txt", timeout=10, headers={"User-Agent": USER_AGENT}, follow_redirects=True)
                if r.status_code >= 400:
                    rp = None  # no robots.txt → allowed
                else:
                    rp.parse(r.text.splitlines())
            except httpx.HTTPError:
                rp = None
            self._robots[root] = rp
        rp = self._robots[root]
        return True if rp is None else rp.can_fetch(USER_AGENT, url)

    @staticmethod
    def _version(text: str) -> str | None:
        m = VERSION_RX.search(text[:3000])
        return m.group(1) if m else None

    async def ingest_source(self, source: KnowledgeSource, urls: list[str] | None = None, max_pages: int | None = None) -> IngestResult:
        result = IngestResult(source_id=source.id, status="ok")
        if not source.enabled:
            result.status = "skipped"
            result.skipped.append({"url": source.base_url, "reason": "Source is disabled. Enable it in the registry first."})
            return result
        targets = urls or source.seed_urls
        limit = min(max_pages or source.max_pages, source.max_pages)
        for url in targets[:limit]:
            if not any(url.startswith(p) for p in source.allowed_prefixes):
                result.skipped.append({"url": url, "reason": "Outside the source's allowed prefixes."})
                continue
            if source.respect_robots and not await asyncio.to_thread(self._allowed_by_robots, url):
                result.skipped.append({"url": url, "reason": "Disallowed by robots.txt."})
                continue
            host = urlparse(url).netloc
            wait = source.rate_limit_seconds - (time.monotonic() - self._last_fetch.get(host, 0))
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_fetch[host] = time.monotonic()
            try:
                async with httpx.AsyncClient(timeout=self.fetch_timeout, follow_redirects=True,
                                             headers={"User-Agent": USER_AGENT}) as client:
                    r = await client.get(url)
                final = str(r.url)
                if not any(final.startswith(p) for p in source.allowed_prefixes):
                    result.skipped.append({"url": url, "reason": f"Redirected outside allowed prefixes ({final})."})
                    continue
                if r.status_code >= 400:
                    result.errors.append({"url": url, "reason": f"HTTP {r.status_code}"})
                    continue
                ctype = r.headers.get("content-type", "")
                if "pdf" in ctype or url.lower().endswith(".pdf"):
                    title, text = Path(urlparse(url).path).stem, pdf_to_text(r.content)
                elif "markdown" in ctype or url.endswith((".md", ".markdown")) or "raw.githubusercontent.com" in url:
                    meta, text = parse_front_matter(r.text)
                    title = meta.get("title") or next((l.lstrip("# ") for l in text.splitlines() if l.startswith("#")), Path(url).stem)
                else:
                    title, text = html_to_text(r.text)
            except (httpx.HTTPError, ValueError) as exc:
                result.errors.append({"url": url, "reason": f"Network error: {type(exc).__name__}"})
                continue
            if len(text.split()) < 50:
                result.skipped.append({"url": url, "reason": "Too little readable text (page may require JavaScript)."})
                continue
            h = content_hash(text)
            doc = KnowledgeDocument(
                id=doc_id_for(source.id, url), source_id=source.id, vendor=source.vendor, product=source.product,
                url=url, title=title or url, doc_type=source.doc_type, retrieved_at=utcnow(), version=self._version(text),
                content_hash=h, technologies=source.technologies,
            )
            self.store.upsert_document(doc, text, reload=False)
            result.ingested.append(url)
        self.store.reload()
        if result.ingested:
            self.registry.mark_ingested(source.id)
        if result.errors and not result.ingested:
            result.status = "failed"
        elif result.errors or result.skipped:
            result.status = "partial" if result.ingested else ("failed" if result.errors else "skipped")
        return result
