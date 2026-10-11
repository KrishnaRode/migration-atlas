"""Expert playbooks ("skills"): markdown guidance injected into prompts when relevant.

Small local models answer far better with a page of senior-architect heuristics for the topic
at hand. Playbooks live in knowledge/skills/*.md with front-matter triggers; selection is
deterministic (technology ids, roles, keywords), so it is explainable and testable.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from atlas.knowledge.ingest import parse_front_matter
from atlas.ontology.service import OntologyService


@dataclass
class Skill:
    id: str
    title: str
    body: str
    technologies: set[str] = field(default_factory=set)
    roles: set[str] = field(default_factory=set)
    keywords: list[str] = field(default_factory=list)
    priority: int = 5
    keyword_only: bool = False  # cross-cutting playbooks (cost, platform choice, executives) fire on the question's topic only


class SkillLibrary:
    def __init__(self, skills_dir: Path, ontology: OntologyService):
        self.ontology = ontology
        self.skills: list[Skill] = []
        for path in sorted(skills_dir.glob("*.md")) if skills_dir.exists() else []:
            if path.name.lower() == "readme.md":
                continue
            meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
            trig = meta.get("triggers") or {}
            self.skills.append(Skill(
                id=meta.get("id", path.stem), title=meta.get("title", path.stem), body=body.strip(),
                technologies=set(trig.get("technologies") or []), roles=set(trig.get("roles") or []),
                keywords=[k.lower() for k in trig.get("keywords") or []], priority=int(meta.get("priority", 5)),
                keyword_only=meta.get("match") == "keywords",
            ))

    def select(self, text: str = "", tech_ids: list[str] | None = None, focus_ids: list[str] | None = None,
               limit: int = 2, estate_ids: list[str] | None = None) -> list[Skill]:
        """Score playbooks: question keywords and focused technologies weigh most, then the wider architecture."""
        lowered = text.lower()
        mentioned = set(self.ontology.mentions(text)) if text else set()
        focus = set(focus_ids or []) | mentioned
        context = set(tech_ids or [])
        context_roles = {self.ontology.get(t).role for t in context | focus if self.ontology.get(t)}
        estate = set(estate_ids or [])
        estate_roles = {self.ontology.get(t).role for t in estate if self.ontology.get(t)}
        # Data and the logic that moves it dominate a migration; schedulers and BI tools matter less.
        importance = {"source-database": 2.0, "legacy-warehouse": 2.0, "mainframe": 2.0, "etl": 1.6, "streaming": 1.2,
                      "orchestrator": 1.0, "processing": 1.0, "bi": 0.6}
        weight = {t: importance.get(self.ontology.get(t).role, 0.8) for t in estate if self.ontology.get(t)}
        focus_roles = {self.ontology.get(t).role for t in focus if self.ontology.get(t)}
        scored = []
        for s in self.skills:
            score = 0.0
            score += 10 * sum(1 for k in s.keywords if re.search(r"(?<![a-z0-9])" + re.escape(k) + r"(?![a-z0-9])", lowered))
            if s.keyword_only:
                if score > 0:
                    scored.append((score + s.priority / 100, s))
                continue
            score += min(6, 4 * len(s.technologies & focus))
            score += min(3, 2 * len(s.roles & focus_roles))
            # What the estate actually runs today matters more than every cross-cutting service on the canvas.
            score += min(3.0, sum(weight[t] for t in s.technologies & estate)) + 0.4 * min(2, len(s.roles & estate_roles))
            # The wider architecture only nudges: the question decides what is relevant.
            score += 0.4 * min(3, len(s.technologies & context))
            score += 0.2 * min(2, len(s.roles & context_roles))
            if score > 0:
                scored.append((score + s.priority / 100, s))
        scored.sort(key=lambda x: -x[0])
        if scored and scored[0][0] >= 3:
            # The question clearly points somewhere: keep only playbooks it actually triggers.
            scored = [x for x in scored if x[0] >= 3]
        if scored:
            # A second playbook must be genuinely relevant, not filler.
            scored = [scored[0]] + [x for x in scored[1:] if x[0] >= 0.6 * scored[0][0]]
        return [s for _, s in scored[:limit]]

    def render(self, skills: list[Skill], max_chars: int = 5200) -> str:
        """Top playbook in full (they are written to fit), the runner-up trimmed to its opening sections."""
        if not skills:
            return ""
        parts, budget = [], max_chars
        for i, s in enumerate(skills):
            take = budget if i == len(skills) - 1 else min(len(s.body), int(max_chars * 0.72))
            body = s.body[:take]
            if len(body) < len(s.body):
                body = body[: body.rfind("\n")] if "\n" in body else body
            parts.append(f"PLAYBOOK — {s.title}\n{body}")
            budget -= len(body)
            if budget < 400:
                break
        return "\n\n".join(parts)
