from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from atlas.ai.copilot import ChatRequest
from atlas.ai.ollama import AIUnavailable
from atlas.ai.router import classify
from atlas.architecture.whatif import interpret_what_if
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
            intent = classify(body.message)
            req = body
            yield _sse("intent", {"intent": intent})
            if intent == "what_if" and body.architecture and body.estate:
                estate, changes = interpret_what_if(body.message, body.estate, svc.ontology)
                if changes:
                    present = {n.tech_id for n in body.architecture.nodes}
                    absent = [svc.ontology.require(t).name for t in estate.exclude_technologies
                              if t not in present and svc.ontology.exists(t) and t not in body.estate.exclude_technologies]
                    if absent:
                        changes = changes + [f"Note: {', '.join(absent)} is not in the current architecture"]
                    yield _sse("action", {"type": "what_if", "question": body.message, "changes": changes})
                    if absent:
                        # State the fact deterministically — small models tend to answer the hypothetical regardless.
                        yield _sse("token", f"**{', '.join(absent)} {'is' if len(absent) == 1 else 'are'} not in this architecture today**, "
                                            "so this scenario mainly constrains future choices. ")
                    req = body.model_copy(update={"extra_context": "Interpreted scenario: " + "; ".join(changes) + ". Explain, addressed directly to the reader, "
                                                  "how this scenario would change THIS architecture: which components change, what improves, what gets "
                                                  "harder, and the main risk. Under 180 words. A 'Create branch' button is shown separately."})
            elif intent == "change" and body.architecture:
                from atlas.api.architecture import ProposeBody, propose  # local import: avoids a router cycle

                try:  # rule proposals are instant; the AI half gets a bounded budget
                    result = await asyncio.wait_for(propose(ProposeBody(architecture=body.architecture, estate=body.estate, request=body.message), svc), 75)
                except asyncio.TimeoutError:
                    result = await propose(ProposeBody(architecture=body.architecture, estate=body.estate, request=body.message, use_ai=False), svc)
                    result["ai_note"] = "The local model was slow, so only rule-based proposals are shown."
                if result["proposals"]:
                    # The proposals are the answer: no second model call, so change requests stay fast.
                    yield _sse("action", {"type": "proposals", "proposals": result["proposals"], "note": result.get("ai_note")})
                    try:
                        model = await svc.ollama.resolve_model()
                    except AIUnavailable:
                        model = None  # rule-backed proposals need no model
                    yield _sse("meta", {"model": model, "citations": [], "playbooks": []})
                    lines = [f"I prepared {len(result['proposals'])} change{'s' if len(result['proposals']) > 1 else ''} for this "
                             "architecture. Nothing is applied until you choose **Apply**:", ""]
                    for p in result["proposals"][:4]:
                        src = "rule engine" if p["source"] == "rules" else "local AI"
                        lines.append(f"- **{p['title']}** — {p['reason']} _({src}, {p['confidence']} confidence)_")
                    yield _sse("token", "\n".join(lines))
                    yield _sse("done", {})
                    return
                else:
                    yield _sse("action", {"type": "no_change", "note": result.get("ai_note")})
            elif intent == "recommend" and len(body.options) > 1 and body.estate:
                for i, a in enumerate(body.options):
                    a.meta.label = a.meta.label or "ABCDEF"[i % 6]
                analysis = svc.options.analyse(body.options, body.estate)
                yield _sse("action", {"type": "fit", "analysis": analysis.model_dump()})
                table = "\n".join(f"Option {f.label} {f.name} [{f.fit_percent}% fit]: " + "; ".join(
                    f"{c.name} {c.score}/3 ({c.evidence})" for c in f.criteria) for f in analysis.fits)
                req = body.model_copy(update={"extra_context": "OPTION FIT TABLE (deterministic, from stated priorities)\n" + table +
                                              "\nRecommend the best-fit option for these priorities, explain why with the evidence, and say "
                                              "when each other option would be the better choice."})
            hits, tokens = await svc.copilot.stream(req)
            model = await svc.ollama.resolve_model()
            yield _sse("meta", {"model": model, "citations": [h.citation.model_dump() | {"snippet": h.text[:280]} for h in hits],
                                "playbooks": [{"id": s.id, "title": s.title} for s in svc.copilot.last_playbooks]})
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
