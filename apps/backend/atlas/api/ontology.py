from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from atlas.api.deps import not_found, services
from atlas.architecture.patterns import from_pattern
from atlas.services import Services

router = APIRouter(tags=["ontology"])


def _card(t) -> dict:
    return {
        "id": t.id, "name": t.name, "vendor": t.vendor, "category": t.category, "role": t.role, "layer": t.layer,
        "stage": t.stage, "legacy": t.legacy, "environment": t.environment, "clouds": t.clouds, "platforms": t.platforms,
        "icon": t.icon, "color": t.color, "description": t.description, "capabilities": t.capabilities[:6], "tags": t.tags,
        "operational_model": t.operational_model, "skills": t.skills,
    }


@router.get("/categories")
def categories(svc: Services = Depends(services)):
    counts: dict[str, int] = {}
    for t in svc.ontology.technologies.values():
        counts[t.category] = counts.get(t.category, 0) + 1
    return [{**c.model_dump(), "count": counts.get(c.id, 0)} for c in svc.ontology.data.categories]


@router.get("/technologies")
def technologies(q: str = "", category: str | None = None, svc: Services = Depends(services)):
    results = svc.ontology.search(q, category=category, limit=500)
    if not q:
        order = {c.id: i for i, c in enumerate(svc.ontology.data.categories)}
        results.sort(key=lambda r: (order.get(r[0].category, 99), r[0].name))
    return [_card(t) for t, _ in results]


@router.get("/technologies/{tech_id}")
def technology(tech_id: str, svc: Services = Depends(services)):
    t = svc.ontology.get(tech_id)
    if not t:
        raise not_found(f"Technology '{tech_id}'")
    o = svc.ontology

    def names(ids):
        return [_card(o.get(i)) for i in ids if o.get(i)]

    replaced_by = [x for x in o.technologies.values() if tech_id in x.replaces]
    hits = svc.store.search(t.name, limit=6, technologies=[tech_id])
    return {
        **t.model_dump(),
        "category_info": next((c.model_dump() for c in o.data.categories if c.id == t.category), None),
        "possible_targets_detail": names(t.possible_targets),
        "alternatives_detail": names(t.alternatives),
        "replaces_detail": names(t.replaces),
        "replaced_by": [_card(x) for x in replaced_by],
        "suggested_next_detail": names(t.suggested_next),
        "related": [_card(x) for x in o.related(tech_id)][:12],
        "mappings": [m.model_dump() for m in o.mappings_for(tech_id)]
        + [m.model_dump() for m in o.data.mappings if tech_id in m.targets and m.source != tech_id],
        "patterns": [{"id": p.id, "name": p.name, "summary": p.summary} for p in o.patterns_with(tech_id)],
        "risks_detail": [o.data.risks[r].model_dump() for r in t.risks if r in o.data.risks],
        "strategies_detail": [o.data.strategies[s].model_dump() for s in t.strategies if s in o.data.strategies],
        "knowledge": [h.model_dump() for h in hits],
        "graph": svc.graph.neighbors(f"tech:{tech_id}", limit=60),
    }


@router.get("/technologies/{tech_id}/suggestions")
def suggestions(tech_id: str, present: str = "", cloud: str | None = None, svc: Services = Depends(services)):
    if not svc.ontology.get(tech_id):
        raise not_found(f"Technology '{tech_id}'")
    items = svc.engine.suggestions(tech_id, set(filter(None, present.split(","))), cloud)
    return [{"technology": _card(i["technology"]), "assessment": i["assessment"].model_dump()} for i in items]


@router.get("/technologies/{tech_id}/replacements")
def replacements(tech_id: str, cloud: str | None = None, svc: Services = Depends(services)):
    if not svc.ontology.get(tech_id):
        raise not_found(f"Technology '{tech_id}'")
    out = []
    for t in svc.ontology.replacement_candidates(tech_id, cloud)[:14]:
        maps = svc.ontology.mappings_between(tech_id, t.id)
        out.append({**_card(t), "mapping": maps[0].model_dump() if maps else None,
                    "cloud_compatible": t.runs_on(cloud)})
    return out


class AssessBody(BaseModel):
    source: str
    target: str


@router.post("/connections/assess")
def assess(body: AssessBody, svc: Services = Depends(services)):
    return svc.engine.assess(body.source, body.target).model_dump()


@router.get("/patterns")
def patterns(svc: Services = Depends(services)):
    return [p.model_dump(by_alias=True) for p in svc.ontology.data.patterns.values()]


@router.get("/patterns/{pattern_id}")
def pattern(pattern_id: str, svc: Services = Depends(services)):
    p = svc.ontology.pattern(pattern_id)
    if not p:
        raise not_found(f"Pattern '{pattern_id}'")
    return p.model_dump(by_alias=True)


@router.post("/patterns/{pattern_id}/instantiate")
def instantiate(pattern_id: str, svc: Services = Depends(services)):
    p = svc.ontology.pattern(pattern_id)
    if not p:
        raise not_found(f"Pattern '{pattern_id}'")
    return from_pattern(p, svc.ontology, svc.engine).model_dump()


@router.get("/ontology/strategies")
def strategies(svc: Services = Depends(services)):
    return [s.model_dump() for s in svc.ontology.data.strategies.values()]


@router.get("/ontology/constraints")
def constraints(svc: Services = Depends(services)):
    return [c.model_dump() for c in svc.ontology.data.constraints.values()]


@router.get("/ontology/mappings")
def mappings(source: str | None = None, target: str | None = None, svc: Services = Depends(services)):
    return [m.model_dump() for m in svc.ontology.mappings_between(source, target)]


@router.get("/ontology/platforms")
def platforms(svc: Services = Depends(services)):
    return svc.ontology.data.platforms.model_dump()


@router.get("/ontology/problems")
def problems(svc: Services = Depends(services)):
    return {"problems": svc.ontology.data.problems}


@router.get("/search")
def global_search(q: str = Query(..., min_length=1), svc: Services = Depends(services)):
    """'Oracle to Databricks' → mappings, patterns, components, knowledge and risks."""
    o = svc.ontology
    mentioned = [tid for tid, _, _ in o.match_aliases(q)]
    techs = [o.get(t) for t in mentioned] or [t for t, _ in o.search(q, limit=8)]
    techs = [t for t in techs if t]
    ids = [t.id for t in techs]
    mappings = []
    if len(ids) >= 2:
        for a in ids:
            for b in ids:
                if a != b:
                    mappings += o.mappings_between(a, b)
    if not mappings:
        for t in ids:
            mappings += o.mappings_for(t)
            mappings += [m for m in o.data.mappings if t in m.targets]
    seen = set()
    mappings = [m for m in mappings if not (m.id in seen or seen.add(m.id))]
    patterns = o.patterns_with(*ids) if len(ids) > 1 else []
    if not patterns:
        patterns = [p for t in ids for p in o.patterns_with(t)]
    pseen = set()
    patterns = [p for p in patterns if not (p.id in pseen or pseen.add(p.id))]
    risk_ids = []
    for m in mappings:
        risk_ids += m.risks
    for t in techs:
        risk_ids += t.risks
    risks = [o.data.risks[r].model_dump() for r in dict.fromkeys(risk_ids) if r in o.data.risks]
    related = []
    for t in techs:
        related += [x for x in o.related(t.id) if x.id not in ids]
    rseen = set()
    related = [x for x in related if not (x.id in rseen or rseen.add(x.id))]
    path = svc.graph.path(f"tech:{ids[0]}", f"tech:{ids[1]}") if len(ids) >= 2 else []
    return {
        "query": q,
        "technologies": [_card(t) for t in techs],
        "mappings": [m.model_dump() for m in mappings[:10]],
        "patterns": [{"id": p.id, "name": p.name, "summary": p.summary} for p in patterns[:6]],
        "knowledge": [h.model_dump() for h in svc.store.search(q, limit=5)],
        "risks": risks[:8],
        "related": [_card(x) for x in related[:10]],
        "graph_path": path,
    }
