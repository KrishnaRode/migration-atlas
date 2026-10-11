"""Ollama client: discovery, model selection, JSON generation and streaming chat.

Every failure is translated into an `AIUnavailable` with a human message — callers fall back to
deterministic output instead of surfacing stack traces.
"""

from __future__ import annotations

import asyncio
import json
import re
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx

from atlas.config import RECOMMENDED_MODEL_PREFIXES

log = logging.getLogger(__name__)


class AIUnavailable(Exception):
    """Ollama is not reachable, the model is missing, or the response was unusable."""

    def __init__(self, message: str, code: str = "ai_unavailable"):
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class OllamaStatus:
    reachable: bool
    base_url: str
    version: str | None
    models: list[dict]
    selected_model: str | None
    recommended: list[str]
    message: str


def _is_embedding_model(name: str) -> bool:
    return any(k in name.lower() for k in ("embed", "bge", "minilm", "e5-"))


class _AnswerFieldDecoder:
    """Incrementally extracts the string value of `"answer"` from a streamed JSON object."""

    _ESCAPES = {'"': '"', "\\": "\\", "/": "/", "b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t"}

    def __init__(self):
        self.buf = ""
        self.pos = -1  # index of the first char of the value, once found
        self.done = False

    def feed(self, piece: str) -> str:
        if self.done:
            return ""
        self.buf += piece
        if self.pos < 0:
            m = re.search(r'"answer"\s*:\s*"', self.buf)
            if not m:
                return ""
            self.pos = m.end()
        out = []
        i = self.pos
        while i < len(self.buf):
            ch = self.buf[i]
            if ch == "\\":
                if i + 1 >= len(self.buf):
                    break
                nxt = self.buf[i + 1]
                if nxt == "u":
                    if i + 6 > len(self.buf):
                        break
                    try:
                        out.append(chr(int(self.buf[i + 2 : i + 6], 16)))
                    except ValueError:
                        pass
                    i += 6
                    continue
                out.append(self._ESCAPES.get(nxt, nxt))
                i += 2
                continue
            if ch == '"':
                self.done = True
                i += 1
                break
            out.append(ch)
            i += 1
        self.pos = i
        return "".join(out)


class OllamaClient:
    def __init__(self, base_url: str, model: str = "", timeout_s: float = 150.0, retries: int = 1):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_s = timeout_s
        self.retries = retries
        self._caps = {}

    _caps: dict[str, list[str]]

    def configure(self, base_url: str | None = None, model: str | None = None) -> None:
        if base_url:
            self.base_url = base_url.rstrip("/")
        if model is not None:
            self.model = model

    # ------------------------------------------------------------------ discovery
    async def list_models(self) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{self.base_url}/api/tags")
                r.raise_for_status()
                models = r.json().get("models", [])
        except (httpx.HTTPError, ValueError) as exc:
            raise AIUnavailable(
                f"Ollama is not reachable at {self.base_url}. Start it with `ollama serve`.", "ollama_unreachable"
            ) from exc
        out = []
        for m in models:
            details = m.get("details") or {}
            out.append({
                "name": m.get("name"),
                "size_gb": round((m.get("size") or 0) / 1e9, 2),
                "family": details.get("family"),
                "parameters": details.get("parameter_size"),
                "quantization": details.get("quantization_level"),
                "embedding": _is_embedding_model(m.get("name", "")),
            })
        return out

    async def status(self) -> OllamaStatus:
        version = None
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.get(f"{self.base_url}/api/version")
                version = r.json().get("version")
            models = await self.list_models()
        except (AIUnavailable, httpx.HTTPError, ValueError) as exc:
            msg = exc.message if isinstance(exc, AIUnavailable) else f"Ollama is not reachable at {self.base_url}."
            return OllamaStatus(False, self.base_url, None, [], self.model or None, list(RECOMMENDED_MODEL_PREFIXES), msg)
        selected = await self.resolve_model(models)
        message = (
            f"Connected. Using {selected}." if selected
            else "Ollama is running but no chat model is installed. Run `ollama pull qwen3:4b`."
        )
        return OllamaStatus(True, self.base_url, version, models, selected, list(RECOMMENDED_MODEL_PREFIXES), message)

    async def resolve_model(self, models: list[dict] | None = None) -> str | None:
        """The configured model if installed, else the best recommended installed model."""
        if models is None:
            models = await self.list_models()
        names = [m["name"] for m in models if not m.get("embedding")]
        if self.model and self.model in names:
            return self.model
        if self.model:
            # Allow "qwen3" to match "qwen3:4b".
            match = next((n for n in names if n.split(":")[0] == self.model.split(":")[0]), None)
            if match:
                return match
        for prefix in RECOMMENDED_MODEL_PREFIXES:
            match = next((n for n in names if n.startswith(prefix)), None)
            if match:
                return match
        return names[0] if names else None

    async def _model(self) -> str:
        model = await self.resolve_model()
        if not model:
            raise AIUnavailable("No local model is installed. Run `ollama pull qwen3:4b` and retry.", "model_missing")
        return model

    # ------------------------------------------------------------------ generation
    async def generate_json(self, system: str, prompt: str, temperature: float = 0.2, num_predict: int = 1400) -> tuple[str, str]:
        """Return (raw_text, model). Hard overall deadline: a stalled Ollama can never hang a request."""
        try:
            return await asyncio.wait_for(self._generate_json(system, prompt, temperature, num_predict),
                                          timeout=self.timeout_s * (self.retries + 1) + 10)
        except asyncio.TimeoutError as exc:
            raise AIUnavailable(f"The local model did not answer within {self.timeout_s:.0f}s.", "timeout") from exc

    async def _generate_json(self, system: str, prompt: str, temperature: float, num_predict: int) -> tuple[str, str]:
        model = await self._model()
        payload = {
            "model": model,
            "system": system,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            # qwen3 and other reasoning models otherwise put output in a separate `thinking`
            # field and leave `response` empty.
            "think": False,
            "options": {"temperature": temperature, "num_predict": num_predict, "num_ctx": 8192},
            "keep_alive": "15m",
        }
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout_s) as client:
                    r = await client.post(f"{self.base_url}/api/generate", json=payload)
                    if r.status_code == 404:
                        raise AIUnavailable(f"Model '{model}' is not installed in Ollama.", "model_missing")
                    if r.status_code == 400 and "think" in r.text:
                        payload.pop("think", None)
                        continue
                    r.raise_for_status()
                    body = r.json()
                text = body.get("response") or body.get("thinking") or ""
                if not text.strip():
                    raise AIUnavailable("The model returned an empty response.", "empty_response")
                return text, model
            except AIUnavailable:
                raise
            except httpx.TimeoutException as exc:
                last_error = exc
                log.warning("ollama generate timed out (attempt %s)", attempt + 1)
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                log.warning("ollama generate failed (attempt %s): %s", attempt + 1, exc)
            await asyncio.sleep(0.5 * (attempt + 1))
        if isinstance(last_error, httpx.TimeoutException):
            raise AIUnavailable(f"The local model took longer than {self.timeout_s:.0f}s to answer.", "timeout")
        raise AIUnavailable(f"Ollama request failed at {self.base_url}.", "ollama_error")

    async def capabilities(self, model: str) -> list[str]:
        if model in self._caps:
            return self._caps[model]
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.post(f"{self.base_url}/api/show", json={"model": model})
                caps = r.json().get("capabilities", []) if r.status_code == 200 else []
        except (httpx.HTTPError, ValueError):
            caps = []
        self._caps[model] = caps
        return caps

    async def chat_stream(self, messages: list[dict], temperature: float = 0.3, envelope: bool | None = None) -> AsyncIterator[str]:
        model = await self._model()
        # Thinking-only models (e.g. qwen3 2507) ignore `think: false` and narrate their reasoning
        # in the answer. JSON mode forces a direct answer; we stream the `answer` field out of it.
        if envelope is None:
            envelope = "thinking" in await self.capabilities(model)
        if envelope:
            messages = [dict(m) for m in messages]
            messages[0]["content"] += (
                '\n\nReturn ONLY a JSON object: {"answer": "<your Markdown answer>"}. '
                "Do not describe your reasoning; write the answer directly.")
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "think": False,
            "options": {"temperature": temperature, "num_ctx": 8192},
            "keep_alive": "15m",
        }
        if envelope:
            payload["format"] = "json"
        decoder = _AnswerFieldDecoder() if envelope else None
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(self.timeout_s, connect=5.0)) as client:
                async with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as r:
                    if r.status_code == 404:
                        raise AIUnavailable(f"Model '{model}' is not installed in Ollama.", "model_missing")
                    r.raise_for_status()
                    async for line in r.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                        except ValueError:
                            continue
                        piece = (chunk.get("message") or {}).get("content") or ""
                        if decoder is not None:
                            piece = decoder.feed(piece)
                        if piece:
                            yield piece
                        if chunk.get("done"):
                            break
        except httpx.TimeoutException as exc:
            raise AIUnavailable("The local model stopped responding.", "timeout") from exc
        except httpx.HTTPError as exc:
            raise AIUnavailable(f"Ollama is not reachable at {self.base_url}.", "ollama_unreachable") from exc

    async def embed(self, texts: list[str], model: str) -> list[list[float]]:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(f"{self.base_url}/api/embed", json={"model": model, "input": texts})
                r.raise_for_status()
                return r.json().get("embeddings", [])
        except (httpx.HTTPError, ValueError) as exc:
            raise AIUnavailable(f"Embedding with '{model}' failed.", "embedding_failed") from exc
