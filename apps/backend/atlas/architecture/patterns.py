"""Instantiate a pattern's diagram template as an editable architecture."""

from __future__ import annotations

from atlas.architecture.ops import ArchitectureBuilder
from atlas.models.architecture import Architecture
from atlas.models.ontology import Pattern
from atlas.ontology.service import OntologyService
from atlas.rules.connections import ConnectionEngine

CLOUD_IDS = ("gcp", "aws", "azure")


def from_pattern(pattern: Pattern, ontology: OntologyService, engine: ConnectionEngine) -> Architecture:
    b = ArchitectureBuilder(ontology, engine, Architecture(name=pattern.name, description=pattern.summary or pattern.description))
    keys = {}
    for tn in pattern.template.nodes:
        if not ontology.exists(tn.tech):
            continue
        keys[tn.key] = b.add(tn.tech, label=tn.label, origin="pattern", reuse=False)
    for te in pattern.template.edges:
        s, t = keys.get(te.from_), keys.get(te.to)
        if s and t:
            b.connect(s, t, label=te.label, kind=te.kind, mode=te.mode, origin="pattern",
                      frequency=te.frequency, latency=te.latency, format=te.format)
    arch = b.arch
    arch.meta.generated_by = f"pattern:{pattern.id}"
    # Infer the target cloud/platform from single-cloud components so validation is cloud-aware.
    votes: dict[str, int] = {}
    for n in arch.nodes:
        t = ontology.get(n.tech_id)
        if t and len([c for c in t.clouds if c in CLOUD_IDS]) == 1:
            c = next(c for c in t.clouds if c in CLOUD_IDS)
            votes[c] = votes.get(c, 0) + 1
    if votes:
        arch.meta.target_cloud = max(votes, key=votes.get)
    platforms = ontology.data.platforms.data_platforms
    arch.meta.data_platform = next((n.tech_id for n in arch.nodes if n.tech_id in platforms), None)
    arch.architecture_notes = [pattern.description] if pattern.description else []
    return arch
