#!/usr/bin/env python3
"""Copilot evaluation harness — runs a fixed suite of questions against the local model and scores them.

Checks per case: intent routing, expected actions (proposals / what-if / fit), playbook selection,
required concepts in the answer, forbidden patterns (self-narration, prompt/instruction leakage),
length and latency. Run it after any prompt, playbook or model change:

    python scripts/eval_ai.py                     # all cases, against http://127.0.0.1:8014
    python scripts/eval_ai.py --only replace,fit  # a subset
    python scripts/eval_ai.py --json out.json     # keep the raw answers
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request

NARRATION = re.compile(r"(^|\n)\s*(okay|the user (wants|is|asked)|i need to|let me|first, i|i'll check|we need to analy[sz]e)", re.I)
LEAKAGE = re.compile(r"INSTRUCTIONS FOR THIS ANSWER|ROUTED REQUEST|Return ONLY a JSON|never repeat or mention them")

CASES = [
    # id, persona, message, expected intent, expected action, playbook id hint, any-of concepts
    ("why-cdc", "architect", "Why is CDC used between Oracle and the lakehouse here?", "question", None, "cdc-and-low-downtime-cutover", ["log", "downtime", "change"]),
    ("staging", "architect", "Can I remove the staging layer?", "question", None, "lakehouse-design", ["landing", "bronze", "replay", "raw"]),
    ("replace-q", "developer", "What can replace Informatica?", "question", None, "etl-modernization", ["dbt", "lakeflow", "declarative", "dataflow"]),
    ("replace", "architect", "Replace Informatica with dbt", "change", "proposals", None, ["dbt"]),
    ("add-dr", "architect", "Add disaster recovery", "change", "proposals", None, ["disaster", "recovery", "region"]),
    ("streaming", "architect", "Add a streaming layer for near-real-time events", "change", "proposals", None, ["pub/sub", "pubsub", "stream"]),
    ("whatif-azure", "architect", "How would this architecture look on Azure?", "what_if", "what_if", None, ["azure", "adls", "event hubs", "purview", "key vault"]),
    ("whatif-kafka", "architect", "What if we avoid Kafka?", "what_if", "what_if", "streaming-and-event-driven", ["not in", "doesn't", "does not", "no kafka", "already"]),
    ("whatif-downtime", "leader", "What if downtime must be under 30 minutes?", "what_if", "what_if", "cdc-and-low-downtime-cutover", ["cdc", "cutover", "rollback", "parallel"]),
    ("fit", "leader", "Which option is the best fit for us?", "recommend", "fit", None, ["option"]),
    ("cto", "leader", "Explain this architecture to a CTO.", "question", None, "explaining-to-executives", ["risk", "cost", "downtime", "wave", "outcome"]),
    ("dev", "developer", "Explain this architecture to a developer.", "question", None, None, ["pipeline", "delta", "sql", "cdc"]),
    ("risks", "leader", "Where are the major migration risks?", "question", None, None, ["risk", "reconcil", "pl/sql", "informatica", "volume"]),
    ("plsql", "developer", "How do we convert PL/SQL stored procedures to Databricks?", "question", None, "oracle-database-modernization", ["spark", "sql", "python", "procedure"]),
    ("fivetran", "architect", "What is Fivetran and could it replace Lakeflow Connect here?", "question", None, None, ["fivetran", "connector", "elt", "cdc"]),
    ("typo", "developer", "Informatca mappings: how hard is the conversion?", "question", None, "etl-modernization", ["mapping", "lookup", "automat", "manual"]),
    ("governance", "architect", "Is our governance good enough for a regulated bank?", "question", None, "data-governance-and-security", ["lineage", "catalog", "access", "audit"]),
    ("cost", "leader", "Suggest a lower-cost alternative.", "change", "proposals", None, ["cost", "licen", "managed", "serverless"]),
    ("mainframe", "architect", "If we also had COBOL and CICS on z/OS, how would you modernize them?", "question", None, "mainframe-modernization", ["cobol", "cics", "refactor", "rehost", "strangler"]),
    ("snowflake-vs", "architect", "Would Snowflake be better than Databricks for this estate?", "question", None, "platform-selection", ["snowflake", "databricks", "depends", "skills", "workload"]),
]


def post_json(api: str, path: str, body: dict, timeout: float = 300):
    req = urllib.request.Request(api + path, data=json.dumps(body).encode(), method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def chat(api: str, body: dict) -> dict:
    req = urllib.request.Request(api + "/ai/chat", data=json.dumps(body).encode(), method="POST", headers={"Content-Type": "application/json"})
    out = {"intent": None, "actions": [], "text": "", "playbooks": [], "citations": 0, "error": None}
    ev = None
    with urllib.request.urlopen(req, timeout=400) as r:
        for raw in r:
            line = raw.decode().rstrip("\n")
            if line.startswith("event: "):
                ev = line[7:]
            elif line.startswith("data: "):
                d = json.loads(line[6:])
                if ev == "intent":
                    out["intent"] = d["intent"]
                elif ev == "action":
                    out["actions"].append(d["type"])
                elif ev == "token":
                    out["text"] += d
                elif ev == "meta":
                    out["playbooks"] = [p["id"] for p in d.get("playbooks", [])]
                    out["citations"] = len(d.get("citations", []))
                elif ev == "error":
                    out["error"] = d["message"]
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8014")
    ap.add_argument("--only", default="")
    ap.add_argument("--json", default="")
    ap.add_argument("--max-seconds", type=float, default=90)
    args = ap.parse_args()
    api = args.api.rstrip("/")
    only = {x.strip() for x in args.only.split(",") if x.strip()}

    project = post_json(api, "/projects/from-sample/retail-oracle-gcp-databricks", {})
    opts = post_json(api, "/architecture/options", {"estate": project["estate"], "use_ai": False})
    options = opts["options"]
    arch = options[0]

    rows, raw = [], []
    print(f"\nCopilot eval → {api}\n")
    for cid, persona, msg, want_intent, want_action, want_playbook, concepts in CASES:
        if only and cid not in only:
            continue
        t = time.time()
        try:
            o = chat(api, {"message": msg, "persona": persona, "architecture": arch, "estate": project["estate"], "options": options})
        except Exception as exc:  # noqa: BLE001
            o = {"intent": None, "actions": [], "text": "", "playbooks": [], "citations": 0, "error": str(exc)}
        secs = time.time() - t
        text = o["text"]
        low = text.lower()
        checks = {
            "intent": o["intent"] == want_intent,
            "action": want_action is None or want_action in o["actions"],
            "playbook": want_playbook is None or want_playbook in o["playbooks"] or want_action == "proposals",
            "concepts": any(c in low for c in concepts),
            "no-narration": not NARRATION.search(text[:400]),
            "no-leakage": not LEAKAGE.search(text),
            "no-echo": not text.strip().lower().startswith(msg.strip().rstrip("?.!").lower()),
            "length": 25 <= len(text.split()) <= 420,
            "latency": secs <= args.max_seconds,
            "no-error": not o["error"],
        }
        passed = sum(checks.values())
        rows.append((cid, passed, len(checks), secs, [k for k, v in checks.items() if not v]))
        raw.append({"id": cid, "message": msg, "secs": round(secs, 1), **o, "checks": checks})
        status = "PASS" if passed == len(checks) else "FAIL"
        print(f"  {status} {cid:16} {passed}/{len(checks)}  {secs:5.1f}s  intent={o['intent']:<9} actions={','.join(o['actions']) or '-':<10} "
              f"playbooks={','.join(o['playbooks']) or '-'}" + (f"  ✗ {', '.join(rows[-1][4])}" if rows[-1][4] else ""), flush=True)

    total = sum(r[1] for r in rows)
    possible = sum(r[2] for r in rows)
    full = sum(1 for r in rows if r[1] == r[2])
    print(f"\n{full}/{len(rows)} cases fully passed · {total}/{possible} checks · median {sorted(r[3] for r in rows)[len(rows)//2]:.0f}s\n")
    if args.json:
        with open(args.json, "w") as fh:
            json.dump(raw, fh, indent=2)
    try:
        urllib.request.urlopen(urllib.request.Request(f"{api}/projects/{project['id']}", method="DELETE"), timeout=10)
    except Exception:  # noqa: BLE001
        pass
    return 0 if full == len(rows) else 1


if __name__ == "__main__":
    sys.exit(main())
