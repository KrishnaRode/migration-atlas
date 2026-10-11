"""Local knowledge store with hybrid retrieval.

Lexical BM25 always works with zero extra downloads. When an Ollama embedding model is
installed (e.g. `nomic-embed-text`) and selected in settings, chunk embeddings are stored too and
retrieval blends cosine similarity with BM25. Both live in the same SQLite file — a deliberately
lightweight equivalent of Chroma for a local-first desktop tool.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from dataclasses import dataclass

from atlas.models.knowledge import Citation, KnowledgeDocument, SearchHit
from atlas.storage.db import Database

_WORD = re.compile(r"[a-z0-9][a-z0-9+#./-]*[a-z0-9+#]|[a-z0-9]")
STOP = set("""a an and are as at be by for from has have in into is it its of on or that the this to was were will with
can may not your you we our they their than then also which such these those how what when where who why do does""".split())


def terms(text: str) -> list[str]:
    return [w for w in _WORD.findall(text.lower()) if w not in STOP and len(w) > 1]


def chunk_text(text: str, target_words: int = 180, overlap: int = 30) -> list[str]:
    """Split on headings/paragraphs, then pack into ~target_words chunks with a small overlap."""
    blocks = [b.strip() for b in re.split(r"\n\s*\n|(?=^#{1,4} )", text, flags=re.M) if b and b.strip()]
    chunks: list[str] = []
    current: list[str] = []
    count = 0
    heading = ""
    for block in blocks:
        if block.startswith("#"):
            heading = block.splitlines()[0].lstrip("# ").strip()
        words = block.split()
        if count + len(words) > target_words and current:
            chunks.append(" ".join(current))
            tail = " ".join(current).split()[-overlap:]
            current = ([f"{heading}:"] if heading else []) + tail
            count = len(current)
        current.append(block)
        count += len(words)
    if current:
        chunks.append(" ".join(current))
    return [c for c in chunks if len(c.split()) >= 8] or ([text.strip()] if text.strip() else [])


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass
class _Chunk:
    id: str
    document_id: str
    text: str
    tf: Counter
    length: int
    embedding: list[float] | None


class KnowledgeStore:
    def __init__(self, db: Database):
        self.db = db
        self._chunks: list[_Chunk] = []
        self._docs: dict[str, dict] = {}
        self._df: Counter = Counter()
        self._avg_len = 1.0
        self.reload()

    # ------------------------------------------------------------------ index
    def reload(self) -> None:
        self._docs = {r["id"]: dict(r) for r in self.db.execute("SELECT * FROM kb_documents")}
        self._chunks = []
        self._df = Counter()
        for r in self.db.execute("SELECT id, document_id, text, embedding FROM kb_chunks ORDER BY document_id, ord"):
            doc = self._docs.get(r["document_id"])
            # Title terms are indexed with each chunk so short chunks stay findable by topic.
            tf = Counter(terms(r["text"] + " " + (doc["title"] if doc else "")))
            self._chunks.append(_Chunk(r["id"], r["document_id"], r["text"], tf, sum(tf.values()) or 1,
                                       json.loads(r["embedding"]) if r["embedding"] else None))
            self._df.update(tf.keys())
        self._avg_len = sum(c.length for c in self._chunks) / len(self._chunks) if self._chunks else 1.0

    # ------------------------------------------------------------------ write
    def has_hash(self, h: str) -> bool:
        return bool(self.db.execute("SELECT 1 FROM kb_documents WHERE content_hash=?", (h,)))

    def upsert_document(self, doc: KnowledgeDocument, text: str, embeddings: list[list[float]] | None = None,
                        reload: bool = True) -> int:
        self.db.execute("DELETE FROM kb_chunks WHERE document_id=?", (doc.id,))
        self.db.execute(
            "INSERT OR REPLACE INTO kb_documents(id, source_id, vendor, product, url, title, doc_type, retrieved_at, version, "
            "content_hash, technologies, text) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (doc.id, doc.source_id, doc.vendor, doc.product, doc.url, doc.title, doc.doc_type, doc.retrieved_at,
             doc.version, doc.content_hash, json.dumps(doc.technologies), text),
        )
        chunks = chunk_text(text)
        rows = []
        for i, c in enumerate(chunks):
            emb = json.dumps(embeddings[i]) if embeddings and i < len(embeddings) else None
            rows.append((f"{doc.id}#{i}", doc.id, i, c, emb))
        self.db.executemany("INSERT INTO kb_chunks(id, document_id, ord, text, embedding) VALUES(?,?,?,?,?)", rows)
        if reload:
            self.reload()
        return len(chunks)

    def delete_document(self, doc_id: str) -> None:
        self.db.execute("DELETE FROM kb_chunks WHERE document_id=?", (doc_id,))
        self.db.execute("DELETE FROM kb_documents WHERE id=?", (doc_id,))
        self.reload()

    # ------------------------------------------------------------------ read
    def documents(self) -> list[KnowledgeDocument]:
        counts = Counter(c.document_id for c in self._chunks)
        return [self._to_doc(d, counts[d["id"]]) for d in sorted(self._docs.values(), key=lambda d: (d["vendor"] or "", d["title"] or ""))]

    def document_text(self, doc_id: str) -> str | None:
        rows = self.db.execute("SELECT text FROM kb_documents WHERE id=?", (doc_id,))
        return rows[0]["text"] if rows else None

    @staticmethod
    def _to_doc(d: dict, chunk_count: int = 0) -> KnowledgeDocument:
        return KnowledgeDocument(
            id=d["id"], source_id=d["source_id"], vendor=d["vendor"] or "", product=d["product"] or "", url=d["url"] or "",
            title=d["title"] or "", doc_type=d["doc_type"] or "", retrieved_at=d["retrieved_at"] or "",
            version=d["version"], content_hash=d["content_hash"] or "",
            technologies=json.loads(d["technologies"] or "[]"), chunk_count=chunk_count,
        )

    def _citation(self, d: dict) -> Citation:
        return Citation(source_id=d["source_id"], vendor=d["vendor"] or "", title=d["title"] or "", url=d["url"] or "",
                        retrieved_at=d["retrieved_at"] or "", doc_type=d["doc_type"] or "")

    def search(self, query: str, limit: int = 6, vendor: str | None = None, technologies: list[str] | None = None,
               doc_type: str | None = None, query_embedding: list[float] | None = None) -> list[SearchHit]:
        q_terms = terms(query)
        if not q_terms and not query_embedding:
            return []
        n = len(self._chunks) or 1
        k1, b = 1.4, 0.75
        tech_filter = set(technologies or [])
        scored: list[tuple[float, _Chunk]] = []
        for c in self._chunks:
            d = self._docs.get(c.document_id)
            if not d:
                continue
            if vendor and (d["vendor"] or "").lower() != vendor.lower():
                continue
            if doc_type and d["doc_type"] != doc_type:
                continue
            doc_techs = set(json.loads(d["technologies"] or "[]"))
            if tech_filter and not (doc_techs & tech_filter):
                continue
            bm25 = 0.0
            for t in q_terms:
                f = c.tf.get(t, 0)
                if not f:
                    continue
                idf = math.log(1 + (n - self._df[t] + 0.5) / (self._df[t] + 0.5))
                bm25 += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * c.length / self._avg_len))
            score = bm25
            if query_embedding and c.embedding:
                score = 0.5 * bm25 / (bm25 + 4.0) * 10 + 5 * _cosine(query_embedding, c.embedding)
            if score > 0:
                scored.append((score, c))
        scored.sort(key=lambda s: -s[0])
        hits: list[SearchHit] = []
        per_doc: Counter = Counter()
        for score, c in scored:
            if per_doc[c.document_id] >= 2:  # keep results diverse across documents
                continue
            per_doc[c.document_id] += 1
            d = self._docs[c.document_id]
            hits.append(SearchHit(chunk_id=c.id, document_id=c.document_id, text=c.text, score=round(score, 3),
                                  citation=self._citation(d), technologies=json.loads(d["technologies"] or "[]")))
            if len(hits) >= limit:
                break
        return hits

    @property
    def size(self) -> int:
        return len(self._docs)


def _cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0
