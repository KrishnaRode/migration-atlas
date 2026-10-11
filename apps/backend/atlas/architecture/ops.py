"""Graph editing primitives used by the generator, proposals and replacement.

All operations return new copies; callers never mutate an architecture they were handed.
"""

from __future__ import annotations

from atlas.models.architecture import (
    Architecture,
    ArchitectureEdge,
    ArchitectureNode,
    Operation,
    Position,
    Proposal,
    new_id,
)
from atlas.ontology.service import OntologyService
from atlas.rules.connections import ConnectionEngine


class ArchitectureBuilder:
    """Accumulates nodes/edges with ontology-aware defaults (layer, edge kind, mode)."""

    def __init__(self, ontology: OntologyService, engine: ConnectionEngine, arch: Architecture | None = None):
        self.ontology = ontology
        self.engine = engine
        self.arch = arch.model_copy(deep=True) if arch else Architecture()

    def find(self, tech_id: str) -> ArchitectureNode | None:
        return next((n for n in self.arch.nodes if n.tech_id == tech_id), None)

    def add(
        self,
        tech_id: str,
        *,
        label: str | None = None,
        origin: str = "rules",
        environment: str | None = None,
        reuse: bool = True,
        node_id: str | None = None,
        layer: str | None = None,
        **data,
    ) -> ArchitectureNode:
        if reuse:
            existing = self.find(tech_id)
            if existing:
                return existing
        tech = self.ontology.require(tech_id)
        node = ArchitectureNode(
            id=node_id or new_id("n"),
            tech_id=tech_id,
            label=label,
            layer=layer or tech.layer,
            environment=environment or default_environment(tech),
            origin=origin,  # type: ignore[arg-type]
            data=data,
        )
        self.arch.nodes.append(node)
        return node

    def connect(
        self,
        source: ArchitectureNode,
        target: ArchitectureNode,
        *,
        label: str | None = None,
        kind: str | None = None,
        mode: str | None = None,
        origin: str = "rules",
        **meta,
    ) -> ArchitectureEdge | None:
        if source.id == target.id:
            return None
        for e in self.arch.edges:
            if e.source == source.id and e.target == target.id:
                return e
        assessment = self.engine.assess(source.tech_id, target.tech_id)
        edge = ArchitectureEdge(
            source=source.id,
            target=target.id,
            kind=kind or assessment.kind,  # type: ignore[arg-type]
            mode=mode or assessment.mode,
            label=label,
            origin=origin,  # type: ignore[arg-type]
            status=assessment.status,
            **meta,
        )
        self.arch.edges.append(edge)
        return edge


def default_environment(tech) -> str:
    if tech.environment == "on-prem" or tech.legacy:
        return "On-Prem"
    if tech.role == "cloud-platform":
        return "Cloud"
    if len(tech.clouds) == 1 and tech.clouds[0] in {"gcp", "aws", "azure"}:
        return {"gcp": "GCP", "aws": "AWS", "azure": "Azure"}[tech.clouds[0]]
    if tech.environment == "saas":
        return "SaaS"
    return "Cloud"


def remove_node(arch: Architecture, node_id: str) -> Architecture:
    out = arch.model_copy(deep=True)
    out.nodes = [n for n in out.nodes if n.id != node_id]
    out.edges = [e for e in out.edges if e.source != node_id and e.target != node_id]
    for g in out.groups:
        g.node_ids = [i for i in g.node_ids if i != node_id]
    return out


def _near(arch: Architecture, anchor_ids: list[str], offset: tuple[float, float] = (0, 140)) -> Position | None:
    anchors = [n.position for n in arch.nodes if n.id in anchor_ids and n.position]
    if not anchors:
        return None
    x = sum(p.x for p in anchors) / len(anchors) + offset[0]
    y = max(p.y for p in anchors) + offset[1]
    return Position(x=x, y=y)


def replace_component(
    arch: Architecture,
    node_id: str,
    new_tech_id: str,
    ontology: OntologyService,
    engine: ConnectionEngine,
) -> tuple[Architecture, list[dict], list[dict]]:
    """Swap a node's technology, keeping every connection that still makes sense.

    Returns (architecture, kept_edges, dropped_edges) where each edge report carries the new
    assessment so the UI can explain what changed.
    """
    out = arch.model_copy(deep=True)
    node = out.node(node_id)
    if node is None:
        raise KeyError(node_id)
    old_tech = node.tech_id
    new_tech = ontology.require(new_tech_id)
    node.tech_id = new_tech_id
    node.label = None
    node.layer = new_tech.layer if node.layer in (None, ontology.require(old_tech).layer) else node.layer
    node.environment = default_environment(new_tech)
    if old_tech not in node.replaces and ontology.require(old_tech).legacy:
        node.replaces.append(old_tech)
    node.strategy = None
    node.suggested_strategy = None  # the old component's suggestion doesn't apply to its replacement
    node.notes = None
    node.origin = "user"

    kept, dropped = [], []
    remaining = []
    for edge in out.edges:
        if node_id not in (edge.source, edge.target):
            remaining.append(edge)
            continue
        assessment = engine.assess_edge(out, edge)
        report = {"edge_id": edge.id, "source": edge.source, "target": edge.target, "assessment": assessment.model_dump()}
        if assessment.status == "INVALID":
            dropped.append(report)
            continue
        edge.status = assessment.status
        if edge.kind != assessment.kind and assessment.status in {"VALID", "VALID_WITH_WARNING"}:
            edge.kind = assessment.kind
        kept.append(report)
        remaining.append(edge)
    out.edges = remaining
    # Notes written about the old component no longer describe this design.
    old = ontology.require(old_tech)
    old_name = old.name
    # Match the product however a note refers to it ("BMC Control-M", "Control-M", "control m").
    names = {old.name.lower(), old.name.split(" ", 1)[-1].lower(), *[a.lower() for a in old.aliases if len(a) > 3]}
    mentions = lambda text: any(n in text.lower() for n in names)  # noqa: E731
    out.architecture_notes = [n for n in out.architecture_notes if not mentions(n)]
    out.architecture_notes.append(f"{old_name} replaced by {new_tech.name} (design decision).")
    out.risks = [r for r in out.risks if not mentions(r.title)]
    return out, kept, dropped


def apply_operations(
    arch: Architecture,
    operations: list[Operation],
    ontology: OntologyService,
    engine: ConnectionEngine,
    origin: str = "ai",
) -> Architecture:
    """Apply a proposal's operations. Temp ids from add_node may be referenced by later ops."""
    builder = ArchitectureBuilder(ontology, engine, arch)
    temp_ids: dict[str, str] = {}

    def resolve(ref: str | None) -> str | None:
        if ref is None:
            return None
        return temp_ids.get(ref, ref)

    for op in operations:
        if op.op == "add_node" and op.tech_id and ontology.exists(op.tech_id):
            node = builder.add(op.tech_id, label=op.label, origin=origin, reuse=False, layer=op.layer)
            if op.node_id:
                temp_ids[op.node_id] = node.id
            anchor_ids = [resolve(c.node) for c in op.connect]
            node.position = _near(builder.arch, [a for a in anchor_ids if a])
            for c in op.connect:
                other = builder.arch.node(resolve(c.node) or "")
                if other is None:
                    continue
                pair = (other, node) if c.direction == "from" else (node, other)
                builder.connect(*pair, kind=c.kind, mode=c.mode, label=c.label, origin=origin)
        elif op.op == "remove_node" and op.node_id:
            builder.arch = remove_node(builder.arch, resolve(op.node_id) or "")
        elif op.op == "replace_node" and op.node_id and op.tech_id and ontology.exists(op.tech_id):
            builder.arch, _, _ = replace_component(builder.arch, resolve(op.node_id) or "", op.tech_id, ontology, engine)
        elif op.op == "add_edge" and op.source and op.target:
            s, t = builder.arch.node(resolve(op.source) or ""), builder.arch.node(resolve(op.target) or "")
            if s and t:
                builder.connect(s, t, kind=op.kind, mode=op.mode, label=op.label, origin=origin)
        elif op.op == "remove_edge" and op.edge_id:
            builder.arch.edges = [e for e in builder.arch.edges if e.id != op.edge_id]
        elif op.op == "set_control" and op.value:
            if op.value not in builder.arch.meta.migration_controls:
                builder.arch.meta.migration_controls.append(op.value)
        elif op.op == "set_strategy" and op.node_id and op.value:
            node = builder.arch.node(resolve(op.node_id) or "")
            if node:
                node.strategy = op.value
    return builder.arch


def apply_proposal(arch: Architecture, proposal: Proposal, ontology: OntologyService, engine: ConnectionEngine) -> Architecture:
    return apply_operations(arch, proposal.operations, ontology, engine, origin=proposal.source)
