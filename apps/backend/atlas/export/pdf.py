"""PDF report rendering with ReportLab (pure Python, no headless browser)."""

from __future__ import annotations

import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from atlas.export.report import ReportData, default_summary, mapping_rows, node_name
from atlas.ontology.service import OntologyService

INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
ACCENT = colors.HexColor("#4F46E5")
LINE = colors.HexColor("#E2E8F0")
SEV = {"critical": "#B91C1C", "high": "#DC2626", "medium": "#D97706", "low": "#2563EB", "info": "#64748B"}


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=base["Title"], fontName="Helvetica-Bold", fontSize=26, leading=30, textColor=INK, alignment=TA_LEFT),
        "sub": ParagraphStyle("s", parent=base["Normal"], fontSize=11, textColor=MUTED, leading=15),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=16, textColor=INK, spaceBefore=14, spaceAfter=8),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12, textColor=ACCENT, spaceBefore=10, spaceAfter=4),
        "body": ParagraphStyle("b", parent=base["Normal"], fontSize=9.5, leading=13.5, textColor=INK),
        "small": ParagraphStyle("sm", parent=base["Normal"], fontSize=8.5, leading=11.5, textColor=MUTED),
        "cell": ParagraphStyle("c", parent=base["Normal"], fontSize=8.5, leading=11, textColor=INK),
        "bullet": ParagraphStyle("bl", parent=base["Normal"], fontSize=9.5, leading=13, leftIndent=10, bulletIndent=0, textColor=INK),
    }


def _p(text: str, style) -> Paragraph:
    return Paragraph(escape(text or ""), style)


def _bullets(items, st) -> list:
    return [Paragraph(escape(i), st["bullet"], bulletText="•") for i in items if i]


def _table(rows: list[list], widths: list[float], st) -> Table:
    data = [[Paragraph(f"<b>{escape(str(c))}</b>", st["cell"]) for c in rows[0]]]
    data += [[Paragraph(escape(str(c)), st["cell"]) for c in r] for r in rows[1:]]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF2FF")),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def render_pdf(data: ReportData, ontology: OntologyService) -> bytes:
    st = _styles()
    buf = io.BytesIO()
    p, a = data.project, data.architecture
    width = A4[0] - 36 * mm

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 10 * mm, f"Migration Atlas · {p.name} · generated locally")
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"{p.name} — Migration Atlas report", author="Migration Atlas")
    s: list = [Spacer(1, 30 * mm), _p("MIGRATION ATLAS", st["small"]), Spacer(1, 4), _p(p.name, st["title"]),
               Spacer(1, 6), _p(a.name, st["sub"])]
    if p.description:
        s += [Spacer(1, 4), _p(p.description, st["sub"])]
    s += [Spacer(1, 14), _p("Executive Summary", st["h1"]), _p(data.executive_summary or default_summary(data, ontology), st["body"])]
    if data.roadmap and data.roadmap.themes:
        s += [Spacer(1, 6), _p("Modernization themes", st["h2"]), *_bullets(data.roadmap.themes, st)]
    s.append(PageBreak())

    s += [_p("Current Estate", st["h1"])]
    rows = [["Technology", "Category", "Typical legacy use"]]
    for tid in p.estate.current_technologies:
        t = ontology.get(tid)
        if t:
            cat = next((c.name for c in ontology.data.categories if c.id == t.category), t.category)
            rows.append([t.name, cat, t.typical_legacy_use or t.description])
    if len(rows) > 1:
        s.append(_table(rows, [width * 0.25, width * 0.15, width * 0.6], st))
    if p.estate.constraints:
        s += [Spacer(1, 6), _p("Constraints: " + ", ".join(
            f"{ontology.data.constraints[c.id].name if c.id in ontology.data.constraints else c.id} ({c.priority})" for c in p.estate.constraints), st["body"])]

    s += [_p("Target Architecture", st["h1"])]
    s += [_p("Architecture Diagram", st["h2"])]
    if data.diagram_png:
        try:
            img = ImageReader(io.BytesIO(data.diagram_png))
            iw, ih = img.getSize()
            scale = min(width / iw, (A4[1] * 0.55) / ih)
            s.append(Image(io.BytesIO(data.diagram_png), width=iw * scale, height=ih * scale))
        except Exception:  # a bad image must not break the report
            s.append(_p("The diagram image could not be embedded.", st["small"]))
    else:
        s.append(_p("Diagram not supplied — export from the studio to include it.", st["small"]))
    s += [_p("Components by layer", st["h2"])]
    layers: dict[str, list[str]] = {}
    for n in a.nodes:
        t = ontology.get(n.tech_id)
        layers.setdefault(n.layer or (t.layer if t else "other"), []).append(node_name(a, n.id, ontology))
    s.append(_table([["Layer", "Components"], *[[k.capitalize(), ", ".join(v)] for k, v in layers.items()]],
                    [width * 0.18, width * 0.82], st))

    s += [_p("Technology Mapping", st["h1"])]
    mrows = [["Source", "Target", "Approach", "Automation"]]
    mrows += [[r["source"], r["target"], r["approach"], r["automation"]] for r in mapping_rows(data, ontology)]
    s.append(_table(mrows, [width * 0.2, width * 0.24, width * 0.42, width * 0.14], st))

    s += [_p("Key Decisions", st["h1"])]
    s += _bullets([f"ADR-{d.number:03d} {d.title} ({d.status})" for d in p.decisions] + a.architecture_notes, st)
    s += [_p("Assumptions", st["h1"]), *_bullets(a.assumptions, st)]
    s += [_p("Risks", st["h1"])]
    if a.risks:
        s.append(_table([["Severity", "Risk", "Detail"], *[[r.severity.upper(), r.title, r.detail] for r in a.risks]],
                        [width * 0.12, width * 0.33, width * 0.55], st))

    s += [_p("Migration Strategy", st["h1"])]
    srows = [["System", "Strategy", "Set by"]]
    for n in a.nodes:
        t = ontology.get(n.tech_id)
        if t and t.legacy:
            strat = n.strategy or n.suggested_strategy
            srows.append([t.name, ontology.data.strategies[strat].name if strat in ontology.data.strategies else (strat or "—"),
                          "User" if n.strategy else "Suggested"])
    if len(srows) > 1:
        s.append(_table(srows, [width * 0.4, width * 0.35, width * 0.25], st))

    s += [PageBreak(), _p("Migration Roadmap", st["h1"])]
    if data.roadmap:
        if data.roadmap.narrative:
            s.append(_p(data.roadmap.narrative, st["body"]))
        for w in data.roadmap.waves:
            if not w.included:
                continue
            block = [_p(f"Wave {w.index} — {w.name}", st["h2"]), _p(w.goal, st["small"])]
            block += _bullets([it.title + (f" — {it.detail}" if it.detail else "") for it in w.activities[:8]], st)
            if w.exit_criteria:
                block.append(_p("Exit: " + "; ".join(w.exit_criteria), st["small"]))
            s.append(KeepTogether(block))
    else:
        s.append(_p("Roadmap not generated yet.", st["small"]))

    s += [_p("Validation Findings", st["h1"])]
    if data.validation.findings:
        vrows = [["Severity", "Category", "Finding"]]
        vrows += [[f.severity.upper(), f.category, f"{f.title}. {f.detail}"] for f in data.validation.findings[:30]]
        t = _table(vrows, [width * 0.12, width * 0.15, width * 0.73], st)
        s.append(t)
    s += [_p("Architecture health", st["h2"])]
    s.append(_table([["Dimension", "Level", "Evidence"], *[[h.name, h.level, h.summary] for h in data.validation.health]],
                    [width * 0.3, width * 0.15, width * 0.55], st))

    s += [_p("Documentation References", st["h1"])]
    seen = set()
    refs = []
    for c in data.citations:
        if c.url not in seen:
            seen.add(c.url)
            refs.append(f"{c.vendor} — {c.title} — {c.url} (retrieved {c.retrieved_at[:10]})")
    s += _bullets(refs, st) if refs else [_p("No documentation references were attached.", st["small"])]
    s += [Spacer(1, 12), _p("Generated locally by Migration Atlas. Architecture data never left this machine.", st["small"])]
    doc.build(s, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
