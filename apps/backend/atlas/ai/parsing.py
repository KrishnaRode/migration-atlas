"""Turning model text into validated, typed objects — or a clean failure."""

from __future__ import annotations

import json
import re
from typing import TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)

_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL)


def extract_json(text: str) -> dict | list | None:
    """Best-effort extraction of the first JSON object/array in `text`."""
    if not text:
        return None
    text = _THINK.sub("", text).strip()
    candidates = [m.group(1) for m in _FENCE.finditer(text)] + [text]
    for cand in candidates:
        cand = cand.strip()
        try:
            return json.loads(cand)
        except ValueError:
            pass
        start = min((i for i in (cand.find("{"), cand.find("[")) if i >= 0), default=-1)
        if start < 0:
            continue
        opener = cand[start]
        closer = "}" if opener == "{" else "]"
        depth, in_str, esc = 0, False, False
        for i in range(start, len(cand)):
            ch = cand[i]
            if in_str:
                esc = (ch == "\\") and not esc
                if ch == '"' and not esc:
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    snippet = cand[start : i + 1]
                    try:
                        return json.loads(snippet)
                    except ValueError:
                        # Trailing commas are the most common small-model defect.
                        try:
                            return json.loads(re.sub(r",\s*([}\]])", r"\1", snippet))
                        except ValueError:
                            break
    return None


def parse_model(text: str, model: type[T]) -> tuple[T | None, str | None]:
    """(object, None) on success; (None, reason) when the output is unusable."""
    data = extract_json(text)
    if data is None:
        return None, "The model's answer did not contain valid JSON."
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        data = data[0]
    try:
        return model.model_validate(data), None
    except ValidationError as exc:
        first = exc.errors()[0]
        return None, f"The model's JSON did not match the expected shape ({'.'.join(map(str, first['loc']))}: {first['msg']})."
