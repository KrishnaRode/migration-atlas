import asyncio

import pytest

from atlas.ai.copilot import _clean_opening, strip_narration
from atlas.ai.router import classify
from atlas.architecture.generator import ArchitectureGenerator
from atlas.architecture.options import OptionPlanner
from atlas.config import Settings
from atlas.knowledge.skills import SkillLibrary


@pytest.fixture
def planner(ontology, engine, validator):
    return OptionPlanner(ontology, ArchitectureGenerator(ontology, engine), validator)


def test_options_are_distinct_and_labelled(planner, retail_estate):
    options = planner.build(retail_estate, count=3)
    assert len(options) == 3
    assert [o.meta.label for o in options] == ["A", "B", "C"]
    assert options[0].meta.variant == "requested"
    assert len({frozenset(n.tech_id for n in o.nodes) for o in options}) == 3
    variants = {o.meta.variant for o in options}
    assert any(v.startswith("platform:") for v in variants)
    assert "coexistence" in variants  # the retail estate has legacy ETL to keep


def test_fit_analysis_has_evidence_and_respects_priorities(planner, retail_estate):
    options = planner.build(retail_estate, count=3)
    analysis = planner.analyse(options, retail_estate)
    assert analysis.recommended_option_id in {o.id for o in options}
    for fit in analysis.fits:
        stated = [c for c in fit.criteria if not c.baseline]
        assert stated[0].id == "minimize-downtime" and stated[0].priority == "high"
        assert all(c.evidence and 0 <= c.score <= 3 for c in fit.criteria)
        assert 0 <= fit.fit_percent <= 100
    assert analysis.choose_when and analysis.caveats


def test_low_rewrite_option_scores_rewrite_highest(planner, retail_estate):
    options = planner.build(retail_estate, count=3)
    fits = {f.variant: f for f in planner.analyse(options, retail_estate).fits}
    rewrite = lambda f: next(c.score for c in f.criteria if c.id == "minimize-rewrite")  # noqa: E731
    assert rewrite(fits["coexistence"]) >= rewrite(fits["requested"])


@pytest.mark.parametrize("message,intent", [
    ("Why did you add Kafka?", "question"),
    ("What can replace Informatica?", "question"),
    ("Replace Informatica with dbt", "change"),
    ("Can you add disaster recovery?", "change"),
    ("Reduce infrastructure complexity.", "change"),
    ("What if we avoid Kafka?", "what_if"),
    ("How would this architecture look on Azure?", "what_if"),
    ("Which option is the best fit for us?", "recommend"),
    ("Explain this architecture to a CTO.", "question"),
])
def test_intent_router(message, intent):
    assert classify(message) == intent


def test_playbook_selection_follows_the_question(ontology, retail_estate):
    lib = SkillLibrary(Settings().knowledge_dir / "skills", ontology)
    assert len(lib.skills) >= 15
    est = retail_estate.current_technologies
    pick = lambda q: [s.id for s in lib.select(q, estate_ids=est)]  # noqa: E731
    assert pick("How do we convert PL/SQL stored procedures?")[0] == "oracle-database-modernization"
    assert pick("Would Snowflake be better than Databricks here?")[0] == "platform-selection"
    assert pick("Explain this to a CTO")[0] == "explaining-to-executives"
    assert pick("Informatca mappings: how hard is the conversion?")[0] == "etl-modernization"  # typo, fuzzy match
    assert "cost-and-finops" not in pick("Can I remove the staging layer?")


def test_narration_is_stripped():
    assert _clean_opening("The user wants X. I need to analyse.\n\nUse dbt here.") == "Use dbt here."
    assert _clean_opening("Okay, let me think. Fivetran is managed ELT.") == "Fivetran is managed ELT."
    assert _clean_opening("Option A fits best.") == "Option A fits best."

    async def gen():
        for t in ["Okay, ", "the user asks. ", "\n\n", "**Recommendation**: use ", "dbt."]:
            yield t

    async def collect():
        return "".join([t async for t in strip_narration(gen())])

    assert asyncio.run(collect()) == "**Recommendation**: use dbt."


def test_replace_request_targets_the_node_that_replaced_the_legacy_tool(client):
    p = client.post("/projects/from-sample/retail-oracle-gcp-databricks").json()
    arch = client.post("/architecture/generate", json={"estate": p["estate"], "use_ai": False}).json()["architecture"]
    r = client.post("/architecture/propose", json={"architecture": arch, "estate": p["estate"], "request": "Replace Informatica with dbt", "use_ai": False}).json()
    assert r["proposals"], r
    op = r["proposals"][0]["operations"][0]
    assert op["op"] == "replace_node" and op["tech_id"] == "dbt"
    node = next(n for n in arch["nodes"] if n["id"] == op["node_id"])
    assert "informatica-powercenter" in node["replaces"]


def test_options_endpoint_without_ai(client):
    p = client.post("/projects/from-sample/media-netezza-bigquery").json()
    r = client.post("/architecture/options", json={"estate": p["estate"], "use_ai": False}).json()
    assert len(r["options"]) >= 2 and r["analysis"]["recommended_option_id"]
    again = client.post("/architecture/analyse-options", json={"options": r["options"], "estate": p["estate"]}).json()
    assert len(again["fits"]) == len(r["options"])


def test_chat_routes_change_requests_to_proposals_offline(client):
    p = client.post("/projects/from-sample/retail-oracle-gcp-databricks").json()
    arch = client.post("/architecture/generate", json={"estate": p["estate"], "use_ai": False}).json()["architecture"]
    with client.stream("POST", "/ai/chat", json={"message": "Add disaster recovery", "architecture": arch, "estate": p["estate"]}) as s:
        body = "".join(s.iter_text())
    assert '"intent": "change"' in body and '"type": "proposals"' in body and "event: done" in body
