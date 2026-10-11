from __future__ import annotations

from fastapi import HTTPException

from atlas.services import Services, get_services


def services() -> Services:
    return get_services()


class AtlasError(HTTPException):
    """An expected, user-facing error. Rendered as {"error": {"code", "message"}}."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(status_code=status, detail={"code": code, "message": message})


def not_found(what: str) -> AtlasError:
    return AtlasError(404, "not_found", f"{what} was not found.")
