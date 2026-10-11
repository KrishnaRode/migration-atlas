from atlas.config import Settings
from atlas.ontology.loader import load_ontology

REQUIRED_DEMO_TECH = [
    "oracle-database", "sql-server", "teradata", "netezza", "ibm-db2", "informatica-powercenter", "ibm-datastage", "ssis",
    "control-m", "apache-airflow", "dbt", "apache-kafka", "google-cloud-storage", "amazon-s3", "adls-gen2", "databricks",
    "bigquery", "snowflake", "amazon-redshift", "azure-synapse", "azure-data-factory", "google-dataflow", "google-pubsub",
    "azure-event-hubs", "unity-catalog", "lakeflow-connect", "tableau", "power-bi", "looker", "aws", "azure", "gcp",
]


def test_ontology_loads_without_integrity_problems():
    s = Settings()
    data = load_ontology(s.ontology_dir, s.patterns_dir)
    assert data.problems == []
    assert len(data.technologies) >= 150
    assert len(data.patterns) >= 11
    assert len(data.mappings) >= 30
    assert set(data.strategies) == {"retain", "retire", "rehost", "relocate", "repurchase", "replatform", "refactor", "rearchitect"}


def test_demo_technologies_are_present(ontology):
    missing = [t for t in REQUIRED_DEMO_TECH if not ontology.exists(t)]
    assert missing == []


def test_every_technology_has_a_known_category_and_layer(ontology):
    categories = {c.id for c in ontology.data.categories}
    layers = {"sources", "ingestion", "storage", "processing", "serving", "consumption", "governance", "security", "operations"}
    for t in ontology.technologies.values():
        assert t.category in categories, t.id
        assert t.layer in layers, t.id


def test_search_ranks_exact_names_first(ontology):
    results = ontology.search("oracle")
    assert results[0][0].id == "oracle-database"
    assert ontology.search("pub/sub")[0][0].id == "google-pubsub"


def test_search_filters_by_category(ontology):
    results = ontology.search("", category="bi")
    assert results and all(t.category == "bi" for t, _ in results)


def test_alias_matching_prefers_longest_phrase(ontology):
    found = [t for t, _, _ in ontology.match_aliases("We run DB2 z/OS with COBOL and Informatica PowerCenter")]
    assert "ibm-db2-zos" in found
    assert "informatica-powercenter" in found
    assert "ibm-db2" not in found


def test_replacement_candidates_put_curated_targets_first(ontology):
    names = [t.id for t in ontology.replacement_candidates("informatica-powercenter", "gcp")[:6]]
    assert "lakeflow-declarative-pipelines" in names
    assert "dbt" in names


def test_mappings_between(ontology):
    assert ontology.mappings_between("oracle-database", "databricks")
    assert ontology.mappings_for("control-m")
