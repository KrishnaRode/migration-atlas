from __future__ import annotations

import base64

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel, ValidationError

from atlas.api.deps import AtlasError, not_found, services
from atlas.export.pdf import render_pdf
from atlas.export.report import ReportData, adr_markdown, to_markdown
from atlas.models.architecture import Architecture
from atlas.models.project import Estate, Project, ProjectCreate, Roadmap
from atlas.services import Services

router = APIRouter(tags=["projects"])


@router.get("/samples")
def samples(svc: Services = Depends(services)):
    return [{k: v for k, v in s.items() if k != "project"} | {
        "current": s["project"]["estate"].get("current_technologies", []),
        "target": [x for x in [s["project"]["estate"].get("target_cloud"), *s["project"]["estate"].get("target_platforms", [])] if x],
    } for s in svc.samples()]


@router.get("/projects")
def list_projects(svc: Services = Depends(services)):
    return [p.model_dump() for p in svc.projects.list()]


@router.post("/projects")
def create_project(body: ProjectCreate, svc: Services = Depends(services)):
    if not body.name.strip():
        raise AtlasError(422, "name_required", "Give the project a name.")
    project = Project(name=body.name.strip(), description=body.description, industry=body.industry or body.estate.industry,
                      estate=body.estate)
    return svc.projects.save(project).model_dump()


@router.post("/projects/from-sample/{sample_id}")
def from_sample(sample_id: str, svc: Services = Depends(services)):
    project = svc.project_from_sample(sample_id)
    if not project:
        raise not_found(f"Sample '{sample_id}'")
    return svc.projects.save(project).model_dump()


@router.get("/projects/{project_id}")
def get_project(project_id: str, svc: Services = Depends(services)):
    p = svc.projects.get(project_id)
    if not p:
        raise not_found("Project")
    return p.model_dump()


@router.put("/projects/{project_id}")
def update_project(project_id: str, body: Project, svc: Services = Depends(services)):
    if not svc.projects.get(project_id):
        raise not_found("Project")
    body.id = project_id
    for d in sorted(body.decisions, key=lambda d: d.created_at):
        if not d.number:
            d.number = max([x.number for x in body.decisions] + [0]) + 1
    return svc.projects.save(body).model_dump()


@router.delete("/projects/{project_id}")
def delete_project(project_id: str, svc: Services = Depends(services)):
    if not svc.projects.delete(project_id):
        raise not_found("Project")
    return {"deleted": project_id}


class ImportProject(BaseModel):
    data: dict


@router.post("/projects/import")
def import_project(body: ImportProject, svc: Services = Depends(services)):
    """Re-import a project (or a bare architecture) exported as JSON."""
    raw = body.data
    try:
        if "options" in raw or "estate" in raw:
            project = Project.model_validate(raw)
            project.id = Project(name="x").id  # never overwrite an existing project on import
        else:
            arch = Architecture.model_validate(raw.get("architecture", raw))
            project = Project(name=arch.name or "Imported architecture", options=[arch], active_option_id=arch.id)
    except ValidationError as exc:
        raise AtlasError(422, "invalid_import", f"This JSON is not a Migration Atlas project or architecture ({exc.errors()[0]['msg']}).") from exc
    project.name = project.name + " (imported)"
    return svc.projects.save(project).model_dump()


class RoadmapBody(BaseModel):
    architecture: Architecture
    estate: Estate | None = None
    persona: str = "leader"
    narrative: bool = False


@router.post("/roadmap/generate")
async def roadmap(body: RoadmapBody, svc: Services = Depends(services)):
    rm = svc.planner.generate(body.architecture, body.estate)
    if body.narrative:
        from atlas.ai.context import render_architecture
        from atlas.ai.prompts import ROADMAP_NARRATIVE_PROMPT

        waves = "\n".join(f"Wave {w.index} {w.name}: " + "; ".join(a.title for a in w.activities[:5]) for w in rm.waves if w.included)
        rm.narrative = await svc.architect_ai.narrative(
            body.persona, ROADMAP_NARRATIVE_PROMPT.format(architecture=render_architecture(body.architecture, svc.ontology), waves=waves))
    # Generating a roadmap defines the migration controls the validator looks for.
    controls = ["parallel-run", "cutover-plan", "rollback-plan"]
    return {"roadmap": rm.model_dump(), "migration_controls": controls}


@router.post("/roadmap/dependencies")
def dependencies(body: RoadmapBody, svc: Services = Depends(services)):
    return svc.planner.dependencies(body.architecture, body.estate).model_dump()


# ---------------------------------------------------------------------- exports


class ExportBody(BaseModel):
    project_id: str | None = None
    project: Project | None = None  # unsaved state from the studio wins over the stored copy
    option_id: str | None = None
    diagram_png: str | None = None  # data URL or base64
    executive_summary: str | None = None


def _report(body: ExportBody, svc: Services) -> ReportData:
    project = body.project or (svc.projects.get(body.project_id) if body.project_id else None)
    if not project:
        raise not_found("Project")
    arch = next((o for o in project.options if o.id == (body.option_id or project.active_option_id)), None) or (
        project.options[0] if project.options else None)
    if not arch:
        raise AtlasError(422, "no_architecture", "Generate or draw an architecture before exporting a report.")
    validation = svc.validator.validate(arch, project.estate)
    roadmap = project.roadmap if project.roadmap and project.roadmap.architecture_id == arch.id else None
    names = " ".join(svc.ontology.get(n.tech_id).name for n in arch.nodes[:12] if svc.ontology.get(n.tech_id))
    citations = [h.citation for h in svc.store.search(names + " migration", limit=8)]
    png = None
    if body.diagram_png:
        try:
            png = base64.b64decode(body.diagram_png.split(",", 1)[-1])
        except (ValueError, TypeError):
            png = None
    return ReportData(project=project, architecture=arch, validation=validation, roadmap=roadmap,
                      citations=citations, executive_summary=body.executive_summary or "", diagram_png=png)


@router.post("/export/markdown")
def export_markdown(body: ExportBody, svc: Services = Depends(services)):
    md = to_markdown(_report(body, svc), svc.ontology)
    return PlainTextResponse(md, media_type="text/markdown; charset=utf-8")


@router.post("/export/pdf")
def export_pdf(body: ExportBody, svc: Services = Depends(services)):
    data = _report(body, svc)
    try:
        pdf = render_pdf(data, svc.ontology)
    except Exception as exc:
        raise AtlasError(500, "pdf_failed", "The PDF could not be generated. Try the Markdown export instead.") from exc
    filename = "".join(c if c.isalnum() else "-" for c in data.project.name.lower()).strip("-") or "migration-atlas"
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}-report.pdf"'})


@router.get("/projects/{project_id}/adrs.md")
def export_adrs(project_id: str, svc: Services = Depends(services)):
    p = svc.projects.get(project_id)
    if not p:
        raise not_found("Project")
    if not p.decisions:
        return PlainTextResponse("# Architecture Decision Records\n\n_No decisions recorded yet._\n", media_type="text/markdown")
    body = "\n\n---\n\n".join(adr_markdown(d) for d in sorted(p.decisions, key=lambda d: d.number))
    return PlainTextResponse(f"# Architecture Decision Records — {p.name}\n\n{body}", media_type="text/markdown")


__all__ = ["router", "Roadmap"]
