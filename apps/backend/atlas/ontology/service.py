"""Query layer over the loaded ontology: lookup, search, alias matching, suggestions."""

from __future__ import annotations

import re
from functools import cached_property

from atlas.models.ontology import MigrationMapping, Pattern, Technology
from atlas.ontology.loader import OntologyData

_TOKEN = re.compile(r"[a-z0-9]+")


def tokens(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


class OntologyService:
    def __init__(self, data: OntologyData):
        self.data = data

    # ------------------------------------------------------------------ lookup
    @property
    def technologies(self) -> dict[str, Technology]:
        return self.data.technologies

    def get(self, tech_id: str) -> Technology | None:
        return self.data.technologies.get(tech_id)

    def require(self, tech_id: str) -> Technology:
        tech = self.get(tech_id)
        if tech is None:
            raise KeyError(tech_id)
        return tech

    def exists(self, tech_id: str | None) -> bool:
        return bool(tech_id) and tech_id in self.data.technologies

    def by_role(self, role: str) -> list[Technology]:
        return [t for t in self.data.technologies.values() if t.role == role]

    def pattern(self, pattern_id: str) -> Pattern | None:
        return self.data.patterns.get(pattern_id)

    # ------------------------------------------------------------------ aliases
    @cached_property
    def alias_index(self) -> list[tuple[str, str]]:
        """(phrase, tech_id) pairs, longest phrase first so 'db2 z/os' beats 'db2'."""
        pairs: dict[str, str] = {}
        for t in self.data.technologies.values():
            for phrase in {t.name.lower(), t.id.replace("-", " "), *[a.lower() for a in t.aliases]}:
                phrase = phrase.strip()
                if len(phrase) < 2:
                    continue
                pairs.setdefault(phrase, t.id)
        return sorted(pairs.items(), key=lambda kv: -len(kv[0]))

    def match_aliases(self, text: str) -> list[tuple[str, str, int]]:
        """Return (tech_id, matched_phrase, char_offset) for each technology mentioned in text.

        Matches are whole-word and non-overlapping; longer phrases win.
        """
        lowered = text.lower()
        taken: list[tuple[int, int]] = []
        found: dict[str, tuple[str, int]] = {}
        for phrase, tech_id in self.alias_index:
            pattern = r"(?<![a-z0-9])" + re.escape(phrase) + r"(?![a-z0-9])"
            for m in re.finditer(pattern, lowered):
                span = (m.start(), m.end())
                if any(s < span[1] and span[0] < e for s, e in taken):
                    continue
                taken.append(span)
                if tech_id not in found:
                    found[tech_id] = (phrase, m.start())
        return sorted(((tid, p, off) for tid, (p, off) in found.items()), key=lambda x: x[2])

    # ------------------------------------------------------------------ search
    def search(self, query: str, category: str | None = None, limit: int = 50) -> list[tuple[Technology, float]]:
        q = query.strip().lower()
        q_tokens = tokens(q)
        results: list[tuple[Technology, float]] = []
        for t in self.data.technologies.values():
            if category and t.category != category:
                continue
            if not q:
                results.append((t, 0.0))
                continue
            score = 0.0
            name = t.name.lower()
            if q == name or q == t.id or q in (a.lower() for a in t.aliases):
                score += 100
            elif name.startswith(q):
                score += 60
            elif q in name:
                score += 40
            hay_name = set(tokens(f"{t.name} {' '.join(t.aliases)} {t.id}"))
            hay_meta = set(tokens(f"{t.vendor} {t.category} {t.role} {' '.join(t.tags)} {' '.join(t.capabilities)}"))
            hay_desc = set(tokens(t.description))
            for tok in q_tokens:
                if tok in hay_name:
                    score += 12
                elif tok in hay_meta:
                    score += 6
                elif tok in hay_desc:
                    score += 2
                elif any(h.startswith(tok) for h in hay_name) and len(tok) >= 2:
                    score += 5
            if score > 0:
                results.append((t, score))
        results.sort(key=lambda r: (-r[1], r[0].name))
        return results[:limit]

    # ------------------------------------------------------------------ mappings
    def mappings_for(self, tech_id: str) -> list[MigrationMapping]:
        return [m for m in self.data.mappings if m.source == tech_id]

    def mappings_between(self, source: str | None, target: str | None) -> list[MigrationMapping]:
        out = []
        for m in self.data.mappings:
            if source and m.source != source:
                continue
            if target and target not in m.targets:
                continue
            out.append(m)
        return out

    def patterns_with(self, *tech_ids: str) -> list[Pattern]:
        wanted = set(tech_ids)
        out = []
        for p in self.data.patterns.values():
            comps = set(p.components) | {n.tech for n in p.template.nodes}
            if wanted <= comps:
                out.append(p)
        return out

    # ------------------------------------------------------------------ relations
    def related(self, tech_id: str) -> list[Technology]:
        """Technologies connected through alternatives / targets / replaces, both directions."""
        tech = self.get(tech_id)
        if not tech:
            return []
        ids = set(tech.alternatives) | set(tech.possible_targets) | set(tech.replaces)
        for other in self.data.technologies.values():
            if tech_id in other.alternatives or tech_id in other.replaces or tech_id in other.possible_targets:
                ids.add(other.id)
        ids.discard(tech_id)
        return [self.data.technologies[i] for i in sorted(ids) if i in self.data.technologies]

    def replacement_candidates(self, tech_id: str, cloud: str | None = None) -> list[Technology]:
        """What could stand in for `tech_id` on the canvas, best first."""
        tech = self.get(tech_id)
        if not tech:
            return []
        ordered: list[str] = []
        for ref in [*tech.possible_targets, *tech.alternatives]:
            if ref not in ordered and ref != tech_id:
                ordered.append(ref)
        for other in self.data.technologies.values():
            if tech_id in other.replaces and other.id not in ordered:
                ordered.append(other.id)
        # Peers in the same role are reasonable experiments too, after the curated ones.
        for other in self.by_role(tech.role):
            if other.id not in ordered and other.id != tech_id and not other.legacy:
                ordered.append(other.id)
        out = [self.data.technologies[i] for i in ordered if i in self.data.technologies]
        if cloud:
            # Keep cloud-compatible options first without hiding the rest.
            out.sort(key=lambda t: 0 if t.runs_on(cloud) else 1)
        return out
