from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from atlas.ai.copilot import ChatRequest
from atlas.ai.ollama import AIUnavailable
from atlas.api.deps import services
from atlas.services import Services

router = APIRouter(tags=["ai"])


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/ai/chat")
async def chat(body: ChatRequest, svc: Services = Depends(services)):
    """Server-sent events: `meta` (citations, model), many `token`, then `done` or `error`."""

    async def events():
        try:
            hits, tokens = await svc.copilot.stream(body)
            model = await svc.ollama.resolve_model()
            yield _sse("meta", {"model": model, "citations": [h.citation.model_dump() | {"snippet": h.text[:280]} for h in hits]})
            async for tok in tokens:
                yield _sse("token", tok)
            yield _sse("done", {})
        except AIUnavailable as exc:
            yield _sse("error", {"code": exc.code, "message": exc.message})
        except Exception:  # never leak a stack trace into the UI
            yield _sse("error", {"code": "internal", "message": "Something went wrong while generating the answer."})

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


class ParseBody(BaseModel):
    text: str
    use_ai: bool = True


@router.post("/estate/parse")
async def parse_estate(body: ParseBody, svc: Services = Depends(services)):
    return (await svc.estate_parser.parse(body.text, use_ai=body.use_ai)).model_dump()
