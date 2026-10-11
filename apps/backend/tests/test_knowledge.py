from atlas.knowledge.graph import NetworkXGraphStore
from atlas.knowledge.ingest import html_to_text, parse_front_matter
from atlas.knowledge.store import KnowledgeStore, chunk_text
from atlas.models.knowledge import KnowledgeDocument
from atlas.storage.db import Database


def test_chunking_keeps_reasonable_sizes():
    text = "\n\n".join(f"## Section {i}\n\n" + "word " * 120 for i in range(5))
    chunks = chunk_text(text)
    assert len(chunks) >= 3
    assert all(len(c.split()) < 400 for c in chunks)


def test_html_extraction_drops_navigation_and_scripts():
    title, text = html_to_text("<html><title>Doc</title><nav>menu</nav><script>x()</script><h2>Heading</h2><p>Body text</p></html>")
    assert title == "Doc" and "menu" not in text and "x()" not in text and "Body text" in text


def test_front_matter():
    meta, body = parse_front_matter("---\ntitle: T\ntechnologies: [dbt]\n---\nHello")
    assert meta["title"] == "T" and body == "Hello"


def test_store_metadata_filtering_and_citations(tmp_path):
    store = KnowledgeStore(Database(tmp_path / "k.db"))
    for i, (vendor, tech, text) in enumerate([
        ("Databricks", "unity-catalog", "Unity Catalog provides lineage and fine grained access control for tables."),
        ("Google Cloud", "google-dataplex", "Dataplex provides lineage and data quality across BigQuery and GCS."),
    ]):
        store.upsert_document(KnowledgeDocument(id=f"d{i}", source_id="t", vendor=vendor, title=f"{vendor} doc",
                                                url=f"https://example.org/{i}", retrieved_at="2026-01-01",
                                                content_hash=str(i), technologies=[tech]), text * 3)
    assert len(store.search("lineage")) == 2
    only = store.search("lineage", vendor="Databricks")
    assert len(only) == 1 and only[0].citation.vendor == "Databricks"
    assert store.search("lineage", technologies=["google-dataplex"])[0].citation.url == "https://example.org/1"


def test_graph_relations_and_paths(tmp_path, ontology):
    g = NetworkXGraphStore(tmp_path / "g.json")
    g.rebuild(ontology, [])
    stats = g.stats()
    assert stats["node_kinds"]["Technology"] == len(ontology.technologies)
    assert {"PROVIDES", "REPLACES", "MIGRATES_TO", "ALTERNATIVE_TO", "CONNECTS_TO"} <= set(stats["relations"])
    assert g.path("tech:oracle-database", "tech:databricks")
    reloaded = NetworkXGraphStore(tmp_path / "g.json")
    assert reloaded.stats()["nodes"] == stats["nodes"]
