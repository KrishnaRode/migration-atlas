from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

from atlas.ai.ollama import AIUnavailable
from atlas.api.deps import AtlasError, not_found, services
from atlas.models.knowledge import IngestRequest, IngestResult, KnowledgeSearchRequest
from atlas.services import Services

router = APIRouter(prefix="/knowledge", tags=["knowledge"])
MAX_UPLOAD = 20 * 1024 * 1024


@router.post("/search")
async def search(body: KnowledgeSearchRequest, svc: Services = Depends(services)):
    emb = None
    model = svc.embedding_model()
    if model:
        try:
            vectors = await svc.ollama.embed([body.query], model)
            emb = vectors[0] if vectors else None
        except AIUnavailable:
            emb = None
    hits = svc.store.search(body.query, limit=body.limit, vendor=body.vendor, technologies=body.technologies,
                            doc_type=body.doc_type, query_embedding=emb)
    return {"hits": [h.model_dump() for h in hits], "mode": "hybrid" if emb else "lexical"}


@router.get("/sources")
def sources(svc: Services = Depends(services)):
    return [s.model_dump() for s in svc.registry.load()]


class SourceToggle(BaseModel):
    enabled: bool


@router.put("/sources/{source_id}")
def toggle_source(source_id: str, body: SourceToggle, svc: Services = Depends(services)):
    if not svc.registry.get(source_id):
        raise not_found(f"Source '{source_id}'")
    svc.registry.set_enabled(source_id, body.enabled)
    return svc.registry.get(source_id).model_dump()


@router.post("/ingest")
async def ingest(body: IngestRequest, svc: Services = Depends(services)):
    """Fetch only from registered, enabled sources and their allowed prefixes."""
    results: list[IngestResult] = []
    if body.source_id:
        src = svc.registry.get(body.source_id)
        if not src:
            raise not_found(f"Source '{body.source_id}'")
        results.append(await svc.ingestor.ingest_source(src, body.urls or None, body.max_pages))
    elif body.urls:
        by_source: dict[str, list[str]] = {}
        rejected = []
        for url in body.urls:
            src = svc.registry.source_for_url(url)
            if src:
                by_source.setdefault(src.id, []).append(url)
            else:
                rejected.append({"url": url, "reason": "Not under any registered documentation source."})
        for sid, urls in by_source.items():
            results.append(await svc.ingestor.ingest_source(svc.registry.get(sid), urls, body.max_pages))
        if rejected:
            results.append(IngestResult(source_id=None, status="skipped", skipped=rejected))
    else:
        raise AtlasError(422, "nothing_to_ingest", "Choose a registered source or paste URLs that belong to one.")
    if any(r.ingested for r in results):
        svc.rebuild_graph()
    return {"results": [r.model_dump() for r in results], "documents": svc.store.size}


@router.post("/upload")
async def upload(file: UploadFile = File(...), vendor: str = Form("Local"), technologies: str = Form(""),
                 svc: Services = Depends(services)):
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise AtlasError(413, "too_large", "Files up to 20 MB can be added to the knowledge base.")
    try:
        doc = svc.ingestor.ingest_upload(file.filename or "document", data, vendor=vendor,
                                         technologies=[t for t in technologies.split(",") if svc.ontology.exists(t.strip())])
    except ValueError as exc:
        raise AtlasError(422, "unreadable_document", str(exc)) from exc
    except Exception as exc:  # pypdf raises many types on damaged files
        raise AtlasError(422, "unreadable_document", "The document could not be read. Is it a valid PDF/HTML/Markdown file?") from exc
    svc.rebuild_graph()
    return doc.model_dump()


@router.get("/documents")
def documents(svc: Services = Depends(services)):
    return [d.model_dump() for d in svc.store.documents()]


@router.get("/documents/{doc_id:path}/text")
def document_text(doc_id: str, svc: Services = Depends(services)):
    text = svc.store.document_text(doc_id)
    if text is None:
        raise not_found("Document")
    return {"id": doc_id, "text": text}


@router.delete("/documents/{doc_id:path}")
def delete_document(doc_id: str, svc: Services = Depends(services)):
    svc.store.delete_document(doc_id)
    svc.rebuild_graph()
    return {"deleted": doc_id}


@router.get("/graph/stats")
def graph_stats(svc: Services = Depends(services)):
    return svc.graph.stats()


@router.get("/graph/neighbors/{node_id:path}")
def graph_neighbors(node_id: str, relations: str = "", svc: Services = Depends(services)):
    rels = [r for r in relations.split(",") if r] or None
    return svc.graph.neighbors(node_id, rels)
