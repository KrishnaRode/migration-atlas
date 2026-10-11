#!/usr/bin/env python3
"""End-to-end smoke test of the demo journey against a running API.

    Estate input → AI architecture → canvas edit (add Pub/Sub, connect) → AI explanation →
    replace Control-M → validation → apply reconciliation → roadmap → what-if & compare → PDF/Markdown export

Uses only the standard library so it runs with any Python 3.10+.

    python scripts/smoke_test.py                 # uses local AI if Ollama is running
    python scripts/smoke_test.py --no-ai         # rules only, ~5 seconds
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

GREEN, RED, DIM, RESET = "\033[32m", "\033[31m", "\033[2m", "\033[0m"
results: list[tuple[str, bool, str]] = []


def call(api: str, method: str, path: str, body=None, raw: bool = False, timeout: float = 300):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(api + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            payload = r.read()
            return payload if raw else json.loads(payload or b"null")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} → {e.code}: {e.read()[:300]!r}") from e


def step(name: str):
    def wrap(fn):
        t = time.time()
        try:
            detail = fn() or ""
            results.append((name, True, f"{detail} {DIM}({time.time() - t:.1f}s){RESET}"))
        except Exception as exc:  # noqa: BLE001 — report and continue so every step is visible
            results.append((name, False, str(exc)))
        print(("  " + GREEN + "✓" if results[-1][1] else "  " + RED + "✗") + RESET, name, "—", results[-1][2], flush=True)
        return fn
    return wrap


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8014")
    ap.add_argument("--no-ai", action="store_true")
    ap.add_argument("--keep", action="store_true", help="keep the demo project instead of deleting it")
    args = ap.parse_args()
    api, use_ai = args.api.rstrip("/"), not args.no_ai
    s: dict = {}
    print(f"\nMigration Atlas smoke test → {api}  (AI {'on' if use_ai else 'off'})\n")

    @step("API healthy, ontology loaded")
    def _():
        h = call(api, "GET", "/health")
        assert h["ontology"]["technologies"] >= 150 and h["ontology"]["problems"] == 0
        s["ai"] = h["ai"]["reachable"] and bool(h["ai"]["model"])
        return f"{h['ontology']['technologies']} technologies · AI: {h['ai']['model'] or 'offline'}"

    @step("Estate input (natural language → ontology)")
    def _():
        text = ("Our current stack has Oracle, Informatica PowerCenter, Control-M, Tableau and around 300 TB of warehouse data. "
                "We want to move to GCP and Databricks while minimizing downtime.")
        parsed = call(api, "POST", "/estate/parse", {"text": text, "use_ai": False})
        e = parsed["estate"]
        assert e["current_technologies"] == ["oracle-database", "informatica-powercenter", "control-m", "tableau"]
        assert e["target_cloud"] == "gcp" and "databricks" in e["target_platforms"]
        s["project"] = call(api, "POST", "/projects", {"name": "Smoke — Retail Data Modernization", "estate": e})
        return f"{len(e['current_technologies'])} current · gcp + databricks · {e['data_volume_tb']:g} TB"

    @step("Generate target architecture (rules → ontology → graph → RAG → local AI → validation)")
    def _():
        r = call(api, "POST", "/architecture/generate", {"estate": s["project"]["estate"], "use_ai": use_ai and s.get("ai", False)})
        s["arch"] = r["architecture"]
        techs = {n["tech_id"] for n in s["arch"]["nodes"]}
        assert {"lakeflow-connect", "delta-bronze", "delta-gold", "databricks-sql", "unity-catalog"} <= techs
        return f"{len(techs)} components · {s['arch']['meta']['ai_status']}"

    @step("Drag Pub/Sub onto the canvas and connect it")
    def _():
        a = s["arch"]
        cdc = next(n for n in a["nodes"] if n["tech_id"] == "lakeflow-connect")
        a["nodes"].append({"id": "n_pubsub", "tech_id": "google-pubsub", "origin": "user", "replaces": []})
        verdict = call(api, "POST", "/connections/assess", {"source": "lakeflow-connect", "target": "google-pubsub"})
        a["edges"].append({"id": "e_pubsub", "source": cdc["id"], "target": "n_pubsub", "kind": verdict["kind"], "origin": "user"})
        assert verdict["status"] == "VALID"
        return f"{verdict['status']} — {verdict['reason']}"

    @step("AI explains the connection (streamed, with citations)")
    def _():
        if not (use_ai and s.get("ai")):
            facts = call(api, "POST", "/architecture/explain", {"architecture": s["arch"], "edge_id": "e_pubsub"})
            return f"AI offline — deterministic explanation: {facts['assessment']['reason'][:60]}…"
        req = urllib.request.Request(api + "/ai/chat", method="POST", headers={"Content-Type": "application/json"},
                                     data=json.dumps({"message": "Explain this connection.", "persona": "architect",
                                                      "architecture": s["arch"], "selected_edge_id": "e_pubsub"}).encode())
        text, cites, event = "", 0, None
        with urllib.request.urlopen(req, timeout=300) as r:
            for line in r:
                line = line.decode().rstrip("\n")
                if line.startswith("event: "):
                    event = line[7:]
                elif line.startswith("data: "):
                    d = json.loads(line[6:])
                    if event == "token":
                        text += d
                    elif event == "meta":
                        cites = len(d["citations"])
                    elif event == "error":
                        raise RuntimeError(d["message"])
        assert len(text) > 80
        return f"{len(text.split())} words, {cites} citations"

    @step("Replace Control-M with Databricks Workflows")
    def _():
        cm = next(n for n in s["arch"]["nodes"] if n["tech_id"] == "control-m")
        r = call(api, "POST", "/architecture/replace-component", {"architecture": s["arch"], "node_id": cm["id"], "new_tech_id": "databricks-workflows"})
        s["arch"] = r["architecture"]
        return f"{len(r['kept'])} connections kept, {len(r['dropped'])} dropped · {r['changes'][0]}"

    @step("Validate → missing reconciliation is flagged")
    def _():
        report = call(api, "POST", "/architecture/validate", {"architecture": s["arch"], "estate": s["project"]["estate"]})
        recon = next(f for f in report["findings"] if f["rule_id"] == "MIG-001")
        s["recon"] = recon["proposal"]
        return f"{len(report['findings'])} findings · {recon['severity']}: {recon['title']}"

    @step("Apply the AI action (reconciliation)")
    def _():
        r = call(api, "POST", "/architecture/apply-proposal", {"architecture": s["arch"], "proposal": s["recon"], "estate": s["project"]["estate"]})
        s["arch"] = r["architecture"]
        assert "MIG-001" not in {f["rule_id"] for f in r["validation"]["findings"]}
        readiness = next(h for h in r["validation"]["health"] if h["id"] == "migration")
        return f"reconciliation added · migration readiness: {readiness['level']}"

    @step("Generate migration roadmap (dependency-ordered waves)")
    def _():
        r = call(api, "POST", "/roadmap/generate", {"architecture": s["arch"], "estate": s["project"]["estate"]})
        rm = r["roadmap"]
        names = {n["id"]: n["label"] for n in rm["dependencies"]["nodes"]}
        s["roadmap"] = rm
        s["arch"]["meta"]["migration_controls"] = r["migration_controls"]
        return f"{sum(w['included'] for w in rm['waves'])} waves · order: {' → '.join(names[i] for i in rm['dependencies']['order'])}"

    @step("What if we use BigQuery instead? → compare options")
    def _():
        w = call(api, "POST", "/architecture/what-if", {"architecture": s["arch"], "estate": s["project"]["estate"], "question": "What if we use BigQuery instead?"})
        cmp = call(api, "POST", "/architecture/compare", {"options": [s["arch"], w["architecture"]], "estate": s["project"]["estate"]})
        s["options"] = [s["arch"], w["architecture"]]
        return f"{w['architecture']['name']} · unique components: {len(cmp['options'][1]['unique_components'])}"

    @step("Export PDF and Markdown reports")
    def _():
        project = {**s["project"], "options": s["options"], "active_option_id": s["arch"]["id"], "roadmap": s["roadmap"]}
        call(api, "PUT", f"/projects/{project['id']}", project)
        pdf = call(api, "POST", "/export/pdf", {"project_id": project["id"]}, raw=True)
        md = call(api, "POST", "/export/markdown", {"project_id": project["id"]}, raw=True).decode()
        assert pdf[:4] == b"%PDF" and "## Migration Roadmap" in md
        return f"PDF {len(pdf) // 1024} KB · Markdown {len(md.splitlines())} lines"

    if not args.keep and s.get("project"):
        try:
            call(api, "DELETE", f"/projects/{s['project']['id']}")
        except RuntimeError:
            pass
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} steps passed.\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
