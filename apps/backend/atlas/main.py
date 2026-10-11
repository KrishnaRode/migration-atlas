"""FastAPI application factory."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from atlas.api import ai, architecture, knowledge, ontology, projects, system
from atlas.config import get_settings
from atlas.services import get_services

log = logging.getLogger("atlas")


def create_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    settings = get_settings()
    app = FastAPI(title="Migration Atlas API", version="0.1.0",
                  description="Local AI-powered migration architecture studio. All data stays on this machine.")
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=False,
                       allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        detail = exc.detail if isinstance(exc.detail, dict) else {"code": "http_error", "message": str(exc.detail)}
        return JSONResponse(status_code=exc.status_code, content={"error": detail})

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(x) for x in first.get("loc", []) if x != "body")
        return JSONResponse(status_code=422, content={"error": {
            "code": "invalid_request", "message": f"Invalid request: {loc} — {first.get('msg', 'bad value')}"}})

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        log.exception("unhandled error")
        return JSONResponse(status_code=500, content={"error": {
            "code": "internal", "message": "Something went wrong on the local server. Check the backend log for details."}})

    for r in (system.router, ontology.router, architecture.router, ai.router, knowledge.router, projects.router):
        app.include_router(r)

    @app.on_event("startup")
    def warm() -> None:
        svc = get_services()
        log.info("Migration Atlas ready: %s technologies, %s patterns, %s knowledge documents",
                 len(svc.ontology.technologies), len(svc.ontology.data.patterns), svc.store.size)

    return app


app = create_app()
