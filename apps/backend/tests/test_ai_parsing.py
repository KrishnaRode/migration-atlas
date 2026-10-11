import asyncio

from pydantic import BaseModel

from atlas.ai.estate_parser import EstateParser
from atlas.ai.ollama import AIUnavailable, OllamaClient, _AnswerFieldDecoder
from atlas.ai.parsing import extract_json, parse_model


class Shape(BaseModel):
    add: list[dict] = []
    notes: list[str] = []


def test_extract_json_handles_fences_think_blocks_and_trailing_commas():
    assert extract_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert extract_json('<think>hmm {"no": 1}</think> Here: {"a": [1, 2,],}') == {"a": [1, 2]}
    assert extract_json('prefix {"a": "x } y"} suffix') == {"a": "x } y"}
    assert extract_json("no json here") is None


def test_parse_model_reports_shape_errors():
    obj, err = parse_model('{"add": [{"tech_id": "dbt"}], "notes": ["ok"]}', Shape)
    assert obj and not err
    obj, err = parse_model('{"add": "not-a-list"}', Shape)
    assert obj is None and "add" in err
    obj, err = parse_model("garbage", Shape)
    assert obj is None and "JSON" in err


def test_answer_field_decoder_streams_escaped_strings():
    d = _AnswerFieldDecoder()
    raw = '{"answer": "**Bold**\\nline \\"q\\" \\u00e9 end", "x": 1}'
    out = "".join(d.feed(c) for c in raw)
    assert out == '**Bold**\nline "q" é end'


def test_estate_parser_extracts_technologies_constraints_and_volume(ontology):
    p = EstateParser(ontology).parse_rules(
        "Our current stack has Oracle, Informatica PowerCenter, Control-M, Tableau and around 300 TB of warehouse data. "
        "We want to move to GCP and Databricks while minimizing downtime.")
    e = p.estate
    assert e.current_technologies == ["oracle-database", "informatica-powercenter", "control-m", "tableau"]
    assert e.target_cloud == "gcp" and e.target_platforms == ["databricks"]
    assert e.data_volume_tb == 300
    assert e.has("minimize-downtime", "high")


def test_estate_parser_detects_cloud_inside_product_phrase(ontology):
    e = EstateParser(ontology).parse_rules("Teradata and Cognos today. Move to Azure Databricks with strict governance.").estate
    assert e.target_cloud == "azure" and "databricks" in e.target_platforms
    assert e.has("strict-governance")


def test_ollama_unreachable_raises_friendly_error():
    client = OllamaClient("http://127.0.0.1:9", timeout_s=1, retries=0)
    try:
        asyncio.run(client.list_models())
        raise AssertionError("expected AIUnavailable")
    except AIUnavailable as exc:
        assert "ollama serve" in exc.message


def test_estate_parse_falls_back_when_ai_is_down(ontology):
    parser = EstateParser(ontology, OllamaClient("http://127.0.0.1:9", timeout_s=1, retries=0))
    result = asyncio.run(parser.parse("Oracle and SSIS to Azure", use_ai=True))
    assert not result.ai_used and "rules only" in result.ai_note
    assert "oracle-database" in result.estate.current_technologies
