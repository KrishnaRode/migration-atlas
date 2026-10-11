"""FastAPI endpoint tests. Ollama is unreachable here on purpose: every AI path must degrade."""


def _retail(client):
    return client.post("/projects/from-sample/retail-oracle-gcp-databricks").json()


def test_health_reports_ontology_and_offline_ai(client):
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["ontology"]["technologies"] >= 150
    assert h["ai"]["reachable"] is False and h["privacy"] == "local"
    assert client.get("/ollama/status").json()["setup"]


def test_technology_endpoints(client):
    assert len(client.get("/technologies").json()) >= 150
    d = client.get("/technologies/informatica-powercenter").json()
    assert d["possible_targets_detail"] and d["mappings"]
    assert client.get("/technologies/nope").status_code == 404
    assert client.get("/technologies/nope").json()["error"]["code"] == "not_found"
    sugg = client.get("/technologies/oracle-database/suggestions", params={"cloud": "gcp"}).json()
    assert sugg[0]["assessment"]["status"]


def test_global_search(client):
    r = client.get("/search", params={"q": "Oracle to Databricks"}).json()
    assert r["mappings"] and r["technologies"] and r["knowledge"]


def test_generation_without_ai_is_fast_and_reports_pipeline(client):
    p = _retail(client)
    r = client.post("/architecture/generate", json={"estate": p["estate"], "use_ai": False}).json()
    assert [s["step"] for s in r["pipeline"]] == ["rules", "ontology", "graph", "rag", "ai", "validate"]
    assert len(r["architecture"]["nodes"]) > 10 and r["validation"]["findings"]


def test_generation_falls_back_when_ollama_is_down(client):
    p = _retail(client)
    r = client.post("/architecture/generate", json={"estate": p["estate"], "use_ai": True}).json()
    assert r["architecture"]["nodes"]
    assert "skipped" in r["architecture"]["meta"]["ai_status"].lower()


def test_empty_estate_is_rejected_cleanly(client):
    r = client.post("/architecture/generate", json={"estate": {}})
    assert r.status_code == 422 and r.json()["error"]["code"] == "empty_estate"


def test_project_persistence_roundtrip(client):
    p = _retail(client)
    arch = client.post("/architecture/generate", json={"estate": p["estate"], "use_ai": False}).json()["architecture"]
    p["options"] = [arch]
    p["active_option_id"] = arch["id"]
    p["decisions"] = [{"title": "Use Databricks Workflows", "decision": "Replace Control-M"}]
    saved = client.put(f"/projects/{p['id']}", json=p).json()
    assert saved["decisions"][0]["number"] == 1
    again = client.get(f"/projects/{p['id']}").json()
    assert again["options"][0]["id"] == arch["id"]
    assert any(s["id"] == p["id"] for s in client.get("/projects").json())
    assert "ADR-001" in client.get(f"/projects/{p['id']}/adrs.md").text
    assert client.delete(f"/projects/{p['id']}").status_code == 200
    assert client.get(f"/projects/{p['id']}").status_code == 404


def test_roadmap_compare_replace_and_whatif(client):
    p = _retail(client)
    arch = client.post("/architecture/generate", json={"estate": p["estate"], "use_ai": False}).json()["architecture"]
    rm = client.post("/roadmap/generate", json={"architecture": arch, "estate": p["estate"]}).json()
    waves = rm["roadmap"]["waves"]
    assert len(waves) == 12 and waves[0]["name"] == "Discovery" and waves[-1]["name"] == "Decommissioning"
    order = rm["roadmap"]["dependencies"]["order"]
    labels = {n["id"]: n["label"] for n in rm["roadmap"]["dependencies"]["nodes"]}
    assert [labels[i] for i in order][0] == "Oracle Database"
    assert set(rm["migration_controls"]) == {"parallel-run", "cutover-plan", "rollback-plan"}

    cm = next(n for n in arch["nodes"] if n["tech_id"] == "control-m")
    rep = client.post("/architecture/replace-component", json={"architecture": arch, "node_id": cm["id"], "new_tech_id": "databricks-workflows"}).json()
    assert rep["changes"] and any(n["tech_id"] == "databricks-workflows" for n in rep["architecture"]["nodes"])

    w = client.post("/architecture/what-if", json={"architecture": arch, "estate": p["estate"], "question": "What if we use BigQuery instead?"}).json()
    assert w["architecture"]["meta"]["parent_id"] == arch["id"] and "Google BigQuery" in w["added"]
    assert client.post("/architecture/what-if", json={"architecture": arch, "estate": p["estate"], "question": "What if??"}).status_code == 422

    cmp = client.post("/architecture/compare", json={"options": [arch, w["architecture"]], "estate": p["estate"]}).json()
    assert len(cmp["options"]) == 2 and cmp["options"][0]["unique_components"]
    assert client.post("/architecture/compare", json={"options": [arch]}).status_code == 422


def test_propose_uses_rules_when_ai_is_down(client):
    p = _retail(client)
    arch = client.post("/architecture/generate", json={"estate": p["estate"], "use_ai": False}).json()["architecture"]
    r = client.post("/architecture/propose", json={"architecture": arch, "estate": p["estate"], "request": "Add reconciliation"}).json()
    assert r["proposals"][0]["title"] == "Add reconciliation"
    applied = client.post("/architecture/apply-proposal", json={"architecture": arch, "proposal": r["proposals"][0], "estate": p["estate"]}).json()
    assert any(n["tech_id"] == "reconciliation-framework" for n in applied["architecture"]["nodes"])


def test_chat_streams_a_friendly_error_when_ollama_is_down(client):
    with client.stream("POST", "/ai/chat", json={"message": "Why Kafka?"}) as r:
        body = "".join(r.iter_text())
    assert "event: error" in body and "Traceback" not in body


def test_exports(client):
    p = _retail(client)
    arch = client.post("/architecture/generate", json={"estate": p["estate"], "use_ai": False}).json()["architecture"]
    p["options"] = [arch]
    p["active_option_id"] = arch["id"]
    md = client.post("/export/markdown", json={"project": p}).text
    for section in ["Executive Summary", "Current Estate", "Target Architecture", "Technology Mapping", "Key Decisions",
                    "Assumptions", "Risks", "Migration Strategy", "Migration Roadmap", "Validation Findings", "Documentation References"]:
        assert f"## {section}" in md
    pdf = client.post("/export/pdf", json={"project": p})
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    assert client.post("/export/pdf", json={"project": {**p, "options": []}}).status_code == 422


def test_import_validation(client):
    bad = client.post("/architecture/import", json={"data": {"nodes": "x"}})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "invalid_architecture"
    good = client.post("/architecture/import", json={"data": {"nodes": [{"tech_id": "oracle-database", "id": "a"}], "edges": [
        {"source": "a", "target": "missing"}]}}).json()
    assert good["architecture"]["edges"] == []


def test_knowledge_search_and_controlled_ingestion(client):
    hits = client.post("/knowledge/search", json={"query": "unity catalog lineage"}).json()["hits"]
    assert hits and hits[0]["citation"]["url"].startswith("https://")
    # Unregistered URLs are refused; disabled sources are skipped — no uncontrolled crawling.
    r = client.post("/knowledge/ingest", json={"urls": ["https://example.com/anything"]}).json()
    assert r["results"][0]["skipped"][0]["reason"].startswith("Not under any registered")
    src = client.get("/knowledge/sources").json()[0]
    r = client.post("/knowledge/ingest", json={"source_id": src["id"]}).json()
    assert r["results"][0]["status"] == "skipped"


def test_knowledge_upload(client):
    md = b"---\ntitle: Our Oracle runbook\nvendor: Internal\n---\n# Runbook\n\n" + b"Oracle GoldenGate extract settings and cutover steps. " * 20
    doc = client.post("/knowledge/upload", files={"file": ("runbook.md", md, "text/markdown")}).json()
    assert doc["title"] == "Our Oracle runbook"
    hits = client.post("/knowledge/search", json={"query": "GoldenGate cutover runbook"}).json()["hits"]
    assert any(h["citation"]["title"] == "Our Oracle runbook" for h in hits)
    bad = client.post("/knowledge/upload", files={"file": ("x.exe", b"MZ", "application/octet-stream")})
    assert bad.status_code == 422
