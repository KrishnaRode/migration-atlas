"""Intent routing for free-text copilot messages.

Deterministic on purpose: it is instant, testable and explainable. Each intent is served by
the capability built for it (proposals, what-if branches, option fit analysis) instead of
asking a small model to improvise everything in prose.
"""

from __future__ import annotations

import re
from typing import Literal

Intent = Literal["question", "change", "what_if", "recommend"]

_WHAT_IF = re.compile(
    r"^\s*(what\s+if|what\s+happens\s+if|suppose|imagine|assume)\b"
    r"|\bhow\s+would\s+(this|it|the\s+architecture)\s+look\b"
    r"|\b(look|work)\s+(like\s+)?on\s+(aws|azure|gcp|google\s+cloud|snowflake|bigquery|databricks|redshift|fabric)\b",
    re.I,
)
_RECOMMEND = re.compile(
    r"\b(which|what)\s+(option|architecture|one|platform|approach)\b.*\b(best|better|recommend|choose|pick|fit)"
    r"|\b(best|better)\s+(fit|option|choice)\b|\bshould\s+we\s+(choose|pick|go\s+with)\b"
    r"|\brecommend(ed|ation)?\b.*\b(option|architecture)\b|\bcompare\s+(the\s+)?options\b",
    re.I,
)
_CHANGE_VERBS = r"(add|suggest|propose|include|introduce|insert|remove|drop|delete|eliminate|replace|swap|switch|substitute|use|make|reduce|simplify|harden|secure|optimi[sz]e|cut|lower|move|put|wire|connect)"
_IMPERATIVE = re.compile(rf"^\s*(please\s+|let'?s\s+|now\s+)?{_CHANGE_VERBS}\b", re.I)
_POLITE = re.compile(rf"\b(can|could|would|will)\s+you\s+(please\s+)?{_CHANGE_VERBS}\b|\b(i|we)\s+(want|need|would\s+like)\s+to\s+{_CHANGE_VERBS}\b", re.I)
_QUESTION_START = re.compile(r"^\s*(why|what|how|when|where|who|which|explain|describe|tell|is|are|does|do|should|can|could|would)\b", re.I)


def classify(message: str) -> Intent:
    text = message.strip()
    if not text:
        return "question"
    if _WHAT_IF.search(text):
        return "what_if"
    if _RECOMMEND.search(text):
        return "recommend"
    if _POLITE.search(text):
        return "change"
    if _IMPERATIVE.search(text) and not _QUESTION_START.search(text):
        return "change"
    return "question"
