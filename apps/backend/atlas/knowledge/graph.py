"""Knowledge graph over the ontology and documentation.

`GraphStore` is the interface; `NetworkXGraphStore` is the V1 implementation persisted as
node-link JSON. A Neo4j store would implement the same four methods.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path

import networkx as nx
from networkx.readwrite import json_graph

from atlas.models.knowledge import KnowledgeDocument
from atlas.ontology.service import OntologyService

RELATIONS = ("PROVIDES", "REPLACES", "CONNECTS_TO", "MIGRATES_TO", "DEPENDS_ON", "ALTERNATIVE_TO",
             "DOCUMENTED_BY", "SUPPORTS", "REQUIRES", "MADE_BY", "HAS_RISK", "PART_OF")


class GraphStore(ABC):
    @abstractmethod
    def rebuild(self, ontology: OntologyService, documents: list[KnowledgeDocument]) -> None: ...

    @abstractmethod
    def neighbors(self, node_id: str, relations: list[str] | None = None, limit: int = 50) -> list[dict]: ...

    @abstractmethod
    def path(self, source: str, target: str, max_hops: int = 4) -> list[dict]: ...

    @abstractmethod
    def stats(self) -> dict: ...


class NetworkXGraphStore(GraphStore):
    def __init__(self, path: Path):
        self.file_path = path
        self.g = nx.MultiDiGraph()
        if path.exists():
            try:
                self.g = json_graph.node_link_graph(json.loads(path.read_text()), directed=True, multigraph=True, edges="links")
            except (ValueError, KeyError, TypeError):
                self.g = nx.MultiDiGraph()

    def _add(self, nid: str, kind: str, label: str, **attrs):
        self.g.add_node(nid, kind=kind, label=label, **attrs)

    def rebuild(self, ontology: OntologyService, documents: list[KnowledgeDocument]) -> None:
        g = self.g = nx.MultiDiGraph()
        for t in ontology.technologies.values():
            self._add(f"tech:{t.id}", "Technology", t.name, category=t.category, role=t.role, legacy=t.legacy)
            vendor = f"vendor:{t.vendor.lower().replace(' ', '-')}"
            self._add(vendor, "Vendor", t.vendor)
            g.add_edge(f"tech:{t.id}", vendor, rel="MADE_BY")
            for c in t.capabilities:
                self._add(f"cap:{c}", "Capability", c)
                g.add_edge(f"tech:{t.id}", f"cap:{c}", rel="PROVIDES")
            for x in t.alternatives:
                g.add_edge(f"tech:{t.id}", f"tech:{x}", rel="ALTERNATIVE_TO")
            for x in t.replaces:
                g.add_edge(f"tech:{t.id}", f"tech:{x}", rel="REPLACES")
            for x in t.possible_targets:
                g.add_edge(f"tech:{t.id}", f"tech:{x}", rel="MIGRATES_TO")
            for x in t.suggested_next:
                g.add_edge(f"tech:{t.id}", f"tech:{x}", rel="CONNECTS_TO")
            for x in t.platforms:
                g.add_edge(f"tech:{t.id}", f"tech:{x}", rel="REQUIRES")
            for r in t.risks:
                g.add_edge(f"tech:{t.id}", f"risk:{r}", rel="HAS_RISK")
        for r in ontology.data.risks.values():
            self._add(f"risk:{r.id}", "Risk", r.title, category=r.category)
        for m in ontology.data.mappings:
            mid = f"mapping:{m.id}"
            self._add(mid, "MigrationPattern", m.title or m.id, automation=m.automation_potential)
            g.add_edge(f"tech:{m.source}", mid, rel="SUPPORTS")
            for t in m.targets:
                g.add_edge(mid, f"tech:{t}", rel="MIGRATES_TO")
        for p in ontology.data.patterns.values():
            pid = f"pattern:{p.id}"
            self._add(pid, "ArchitecturePattern", p.name)
            for c in set(p.components) | {n.tech for n in p.template.nodes}:
                g.add_edge(f"tech:{c}", pid, rel="PART_OF")
        for d in documents:
            did = f"doc:{d.id}"
            self._add(did, "Documentation", d.title, url=d.url, vendor=d.vendor)
            for t in d.technologies:
                if f"tech:{t}" in g:
                    g.add_edge(f"tech:{t}", did, rel="DOCUMENTED_BY")
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self.file_path.write_text(json.dumps(json_graph.node_link_data(g, edges="links")))

    def neighbors(self, node_id: str, relations: list[str] | None = None, limit: int = 50) -> list[dict]:
        if node_id not in self.g:
            return []
        out = []
        for _, v, data in self.g.out_edges(node_id, data=True):
            if relations and data.get("rel") not in relations:
                continue
            out.append({"direction": "out", "relation": data.get("rel"), "id": v, **self.g.nodes[v]})
        for u, _, data in self.g.in_edges(node_id, data=True):
            if relations and data.get("rel") not in relations:
                continue
            out.append({"direction": "in", "relation": data.get("rel"), "id": u, **self.g.nodes[u]})
        return out[:limit]

    def path(self, source: str, target: str, max_hops: int = 4) -> list[dict]:
        if source not in self.g or target not in self.g:
            return []
        try:
            nodes = nx.shortest_path(self.g, source, target)
        except nx.NetworkXNoPath:
            return []
        if len(nodes) - 1 > max_hops:
            return []
        steps = []
        for a, b in zip(nodes, nodes[1:]):
            rel = next(iter(self.g.get_edge_data(a, b).values())).get("rel")
            steps.append({"from": a, "from_label": self.g.nodes[a].get("label"), "relation": rel,
                          "to": b, "to_label": self.g.nodes[b].get("label")})
        return steps

    def stats(self) -> dict:
        kinds: dict[str, int] = {}
        for _, d in self.g.nodes(data=True):
            kinds[d.get("kind", "?")] = kinds.get(d.get("kind", "?"), 0) + 1
        rels: dict[str, int] = {}
        for _, _, d in self.g.edges(data=True):
            rels[d.get("rel", "?")] = rels.get(d.get("rel", "?"), 0) + 1
        return {"nodes": self.g.number_of_nodes(), "edges": self.g.number_of_edges(), "node_kinds": kinds, "relations": rels}

    def describe(self, tech_id: str) -> str:
        """Short text summary of a technology's graph neighbourhood for prompts."""
        items = self.neighbors(f"tech:{tech_id}", ["REPLACES", "MIGRATES_TO", "ALTERNATIVE_TO", "PART_OF", "HAS_RISK"], limit=30)
        by_rel: dict[str, list[str]] = {}
        for it in items:
            key = f"{it['relation']}{'' if it['direction'] == 'out' else ' (inbound)'}"
            by_rel.setdefault(key, []).append(it.get("label") or it["id"])
        return "; ".join(f"{k}: {', '.join(sorted(set(v))[:6])}" for k, v in by_rel.items())
