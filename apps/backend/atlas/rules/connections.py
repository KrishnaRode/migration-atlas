"""Connection intelligence: is A → B a sensible flow, and why.

Deterministic. Rules come from ontology/connection_rules.yaml; this module only decides which
rule is most specific for a pair.
"""

from __future__ import annotations

from atlas.models.architecture import Architecture, ArchitectureEdge, ConnectionAssessment
from atlas.models.ontology import ConnectionRule, Technology
from atlas.ontology.service import OntologyService

_SPECIFICITY = {"tech": 3, "stage": 2, "role": 1}


def _match(selector: str, tech: Technology) -> int | None:
    """Specificity score if `selector` matches `tech`, else None."""
    if selector == "*":
        return 0
    kind, _, value = selector.partition(":")
    if kind == "tech" and tech.id == value:
        return _SPECIFICITY["tech"]
    if kind == "stage" and tech.stage == value:
        return _SPECIFICITY["stage"]
    if kind == "role" and tech.role == value:
        return _SPECIFICITY["role"]
    return None


class ConnectionEngine:
    def __init__(self, ontology: OntologyService):
        self.ontology = ontology
        self.rules: list[ConnectionRule] = ontology.data.rules
        self.default = ontology.data.default_rule or {
            "status": "UNKNOWN",
            "reason": "No rule describes this pair yet.",
        }

    def best_rule(self, source: Technology, target: Technology) -> ConnectionRule | None:
        best: tuple[int, int, ConnectionRule] | None = None
        for rule in self.rules:
            s = _match(rule.from_, source)
            if s is None:
                continue
            t = _match(rule.to, target)
            if t is None:
                continue
            # Total specificity first; ties prefer the more specific source end.
            key = (s + t, s)
            if best is None or key > best[:2]:
                best = (key[0], key[1], rule)
        return best[2] if best else None

    def assess(self, source_tech_id: str, target_tech_id: str) -> ConnectionAssessment:
        source = self.ontology.get(source_tech_id)
        target = self.ontology.get(target_tech_id)
        if source is None or target is None:
            missing = source_tech_id if source is None else target_tech_id
            return ConnectionAssessment(
                status="UNKNOWN",
                reason=f"'{missing}' is not in the technology ontology, so the connection cannot be reasoned about.",
                source_tech=source_tech_id,
                target_tech=target_tech_id,
            )
        if source.id == target.id and source.role not in {"lake-layer", "streaming", "mainframe"}:
            return ConnectionAssessment(
                status="UNUSUAL",
                reason=f"Connecting {source.name} to another {target.name} is unusual — usually this indicates a duplicate node or a migration bridge.",
                source_tech=source.id,
                target_tech=target.id,
            )
        rule = self.best_rule(source, target)
        if rule is None:
            return ConnectionAssessment(
                status=self.default.get("status", "UNKNOWN"),
                reason=self.default.get("reason", ""),
                source_tech=source.id,
                target_tech=target.id,
            )
        return ConnectionAssessment(
            status=rule.status,
            reason=self._personalise(rule.reason, source, target),
            suggestion=rule.suggestion,
            kind=rule.kind,
            mode=rule.mode,
            matched_rule=f"{rule.from_} -> {rule.to}",
            source_tech=source.id,
            target_tech=target.id,
        )

    @staticmethod
    def _personalise(reason: str, source: Technology, target: Technology) -> str:
        # Rules are written generically ("This orchestrator ..."); name the real products.
        return reason.replace("This orchestrator", source.name).replace("this component", target.name)

    def assess_edge(self, arch: Architecture, edge: ArchitectureEdge) -> ConnectionAssessment:
        src = arch.node(edge.source)
        dst = arch.node(edge.target)
        if src is None or dst is None:
            return ConnectionAssessment(status="INVALID", reason="The edge points at a node that no longer exists.")
        result = self.assess(src.tech_id, dst.tech_id)
        # A data edge where the rule says the relationship is control-plane only deserves a nudge,
        # unless the rule already explains it with a warning.
        if edge.kind == "data" and result.kind == "control" and result.status == "VALID":
            result = result.model_copy(
                update={
                    "status": "VALID_WITH_WARNING",
                    "reason": result.reason + " Mark this edge as a control dependency rather than a data flow.",
                }
            )
        return result

    def annotate(self, arch: Architecture) -> dict[str, ConnectionAssessment]:
        statuses: dict[str, ConnectionAssessment] = {}
        for edge in arch.edges:
            assessment = self.assess_edge(arch, edge)
            edge.status = assessment.status
            statuses[edge.id] = assessment
        return statuses

    def suggestions(self, tech_id: str, present: set[str] | None = None, cloud: str | None = None, limit: int = 8):
        """Smart 'possible next components' when a technology is dropped on the canvas."""
        tech = self.ontology.get(tech_id)
        if tech is None:
            return []
        present = present or set()
        out = []
        for ref in tech.suggested_next:
            other = self.ontology.get(ref)
            if other is None or ref in present:
                continue
            if cloud and not other.runs_on(cloud) and other.role != "cloud-platform":
                continue
            # Cloud platforms "host" their services; everything else is a downstream flow.
            assessment = self.assess(tech.id, other.id)
            out.append({"technology": other, "assessment": assessment})
            if len(out) >= limit:
                break
        return out
