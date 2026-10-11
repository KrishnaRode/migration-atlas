import pytest


@pytest.mark.parametrize("source,target,status", [
    ("oracle-database", "lakeflow-connect", "VALID"),
    ("lakeflow-connect", "delta-bronze", "VALID"),
    ("delta-bronze", "delta-silver", "VALID"),
    ("delta-silver", "delta-gold", "VALID"),
    ("delta-silver", "tableau", "VALID_WITH_WARNING"),
    ("control-m", "google-cloud-storage", "VALID_WITH_WARNING"),
    ("delta-gold", "delta-bronze", "INVALID"),
    ("oracle-database", "tableau", "UNUSUAL"),
    ("databricks-sql", "tableau", "VALID"),
    ("unity-catalog", "databricks", "VALID"),
])
def test_connection_rules(engine, source, target, status):
    assert engine.assess(source, target).status == status


def test_control_m_warning_explains_orchestration(engine):
    a = engine.assess("control-m", "google-cloud-storage")
    assert "Control-M" in a.reason
    assert "orchestr" in a.reason.lower() or "scheduler" in a.reason.lower()
    assert a.kind == "control"


def test_unknown_technology_is_unknown_not_an_error(engine):
    a = engine.assess("oracle-database", "not-a-real-thing")
    assert a.status == "UNKNOWN"


def test_specificity_tech_beats_role(engine):
    a = engine.assess("lakeflow-connect", "delta-bronze")
    assert a.matched_rule.startswith("tech:")


def test_smart_suggestions(engine):
    oracle = [s["technology"].id for s in engine.suggestions("oracle-database", cloud="gcp")]
    assert "lakeflow-connect" in oracle
    dbx = [s["technology"].id for s in engine.suggestions("databricks")]
    assert dbx[:2] == ["unity-catalog", "databricks-workflows"]
    gcp = [s["technology"].id for s in engine.suggestions("gcp")]
    assert {"google-cloud-storage", "google-pubsub", "bigquery"} <= set(gcp)


def test_suggestions_skip_components_already_present(engine):
    ids = [s["technology"].id for s in engine.suggestions("databricks", present={"unity-catalog"})]
    assert "unity-catalog" not in ids
