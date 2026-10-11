from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from atlas.ai.ollama import AIUnavailable
from atlas.api.deps import services
from atlas.services import Services

router = APIRouter(tags=["system"])


@router.get("/health")
async def health(svc: Services = Depends(services)):
    status = await svc.ollama.status()
    return {
        "status": "ok",
        "version": "0.1.0",
        "ontology": {
            "technologies": len(svc.ontology.technologies),
            "patterns": len(svc.ontology.data.patterns),
            "mappings": len(svc.ontology.data.mappings),
            "rules": len(svc.ontology.data.rules),
            "problems": len(svc.ontology.data.problems),
        },
        "knowledge": {"documents": svc.store.size},
        "ai": {"reachable": status.reachable, "model": status.selected_model, "message": status.message},
        "privacy": "local",
    }


@router.get("/ollama/status")
async def ollama_status(svc: Services = Depends(services)):
    s = await svc.ollama.status()
    return {
        "reachable": s.reachable, "base_url": s.base_url, "version": s.version, "models": s.models,
        "selected_model": s.selected_model, "configured_model": svc.ollama.model or None,
        "recommended": s.recommended, "message": s.message, "embedding_model": svc.embedding_model(),
        "setup": [
            "Install Ollama from https://ollama.com/download",
            "Start it: ollama serve",
            "Pull a model: ollama pull qwen3:4b  (or llama3.1:8b, mistral, gemma3)",
            "Optional, for semantic search: ollama pull nomic-embed-text",
        ],
    }


@router.get("/ollama/models")
async def ollama_models(svc: Services = Depends(services)):
    try:
        return {"models": await svc.ollama.list_models()}
    except AIUnavailable as exc:
        return {"models": [], "error": exc.message}


class SettingsUpdate(BaseModel):
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    embedding_model: str | None = None


@router.put("/settings")
async def update_settings(body: SettingsUpdate, svc: Services = Depends(services)):
    if body.ollama_base_url:
        svc.db.set_setting("ollama_base_url", body.ollama_base_url.strip())
    if body.ollama_model is not None:
        svc.db.set_setting("ollama_model", body.ollama_model.strip())
    if body.embedding_model is not None:
        svc.db.set_setting("embedding_model", body.embedding_model.strip() or None)
    svc.ollama.configure(base_url=body.ollama_base_url, model=body.ollama_model)
    return await ollama_status(svc)


@router.post("/ollama/test")
async def ollama_test(svc: Services = Depends(services)):
    try:
        raw, model = await svc.ollama.generate_json(
            "Return only JSON.", 'Reply with {"ok": true, "message": "<five words about local AI>"}', num_predict=60
        )
        return {"ok": True, "model": model, "sample": raw[:200]}
    except AIUnavailable as exc:
        return {"ok": False, "error": exc.message, "code": exc.code}
