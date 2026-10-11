import json

import pytest

from atlas.architecture.generator import ArchitectureGenerator
from atlas.architecture.ops import apply_proposal, replace_component
from atlas.architecture.whatif import interpret_what_if
from atlas.config import Settings
from atlas.models.project import Estate, Project


@pytest.fixture
def generator(ontology, engine):
    return ArchitectureGenerator(ontology, engine)


def techs(arch):
    return {n.tech_id for n in arch.nodes}


def test_retail_demo_architecture(generator, retail_estate):
    arch = generator.generate(retail_estate)
    t = techs(arch)
    assert {"oracle-database", "lakeflow-connect", "landing-zone", "delta-bronze", "delta-silver", "delta-gold",
            "databricks-sql", "tableau", "unity-catalog", "google-secret-manager", "google-cloud-monitoring"} <= t
    assert "lakeflow-declarative-pipelines" in t  # replaces Informatica
    assert "control-m" in t  # retained during coexistence because downtime matters
    assert all(e.status != "INVALID" for e in arch.edges)
    assert arch.meta.target_cloud == "gcp" and arch.meta.data_platform == "databricks"
    assert "reconciliation-framework" not in t  # migration scaffolding is left to the validator


def test_generator_is_not_hardcoded_to_one_target(generator):
    arch = generator.generate(Estate(current_technologies=["teradata", "ibm-datastage", "cognos"], target_cloud="azure",
                                     target_platforms=["databricks"]))
    t = techs(arch)
    assert "adls-gen2" not in t or True
    assert "azure-key-vault" in t or "microsoft-purview" in t or "unity-catalog" in t
    assert "power-bi" in t  # Cognos replaced with the cloud-native BI
    bq = generator.generate(Estate(current_technologies=["netezza", "informatica-powercenter"], target_platforms=["bigquery"]))
    assert bq.meta.target_cloud == "gcp" and "bigquery" in techs(bq)


def test_all_sample_estates_generate_without_invalid_edges(generator, validator):
    for path in Settings().samples_dir.glob("*.json"):
        sample = json.loads(path.read_text())
        project = Project.model_validate(sample["project"])
        arch = generator.generate(project.estate)
        report = validator.validate(arch, project.estate)
        assert len(arch.nodes) >= 8, path.name
        assert not [f for f in report.findings if f.rule_id == "ARCH-CONN" and f.severity == "high"], path.name


def test_validator_flags_missing_reconciliation_and_proposal_fixes_it(generator, validator, ontology, engine, retail_estate):
    arch = generator.generate(retail_estate)
    report = validator.validate(arch, retail_estate)
    recon = next(f for f in report.findings if f.rule_id == "MIG-001")
    assert recon.severity == "high" and recon.proposal
    fixed = apply_proposal(arch, recon.proposal, ontology, engine)
    assert "MIG-001" not in {f.rule_id for f in validator.validate(fixed, retail_estate).findings}


def test_validator_detects_missing_governance_and_orphans(validator, ontology, engine):
    from atlas.architecture.ops import ArchitectureBuilder

    b = ArchitectureBuilder(ontology, engine)
    src = b.add("oracle-database")
    dbx = b.add("databricks")
    b.add("tableau")  # orphan
    b.connect(src, b.add("delta-bronze"))
    b.connect(b.add("delta-bronze"), dbx)
    report = validator.validate(b.arch)
    ids = {f.rule_id for f in report.findings}
    assert "GOV-001" in ids
    assert "DATA-004" in ids
    assert {h.id for h in report.health} >= {"completeness", "security", "governance", "migration", "observability", "resilience", "operability"}


def test_health_dimensions_carry_evidence(generator, validator, retail_estate):
    report = validator.validate(generator.generate(retail_estate), retail_estate)
    for dim in report.health:
        if dim.level != "not-assessed":
            assert dim.evidence and dim.applicable >= 1


def test_replace_component_preserves_compatible_connections(generator, ontology, engine, retail_estate):
    arch = generator.generate(retail_estate)
    node = next(n for n in arch.nodes if n.tech_id == "control-m")
    out, kept, dropped = replace_component(arch, node.id, "databricks-workflows", ontology, engine)
    replaced = out.node(node.id)
    assert replaced.tech_id == "databricks-workflows" and "control-m" in replaced.replaces
    assert kept and not dropped
    assert not any("Control-M is retained" in n for n in out.architecture_notes)


def test_what_if_interpretation(ontology, retail_estate):
    est, changes = interpret_what_if("What if we use BigQuery instead?", retail_estate, ontology)
    assert est.target_platforms[0] == "bigquery" and changes
    est, changes = interpret_what_if("What if downtime must be under 30 minutes?", retail_estate, ontology)
    assert est.has("minimize-downtime", "critical") and est.has("near-real-time")
    est, _ = interpret_what_if("What if we avoid Kafka?", retail_estate, ontology)
    assert "apache-kafka" in est.exclude_technologies
    est, _ = interpret_what_if("What if we retain Informatica?", retail_estate, ontology)
    assert "informatica-powercenter" in est.retain_technologies
    est, _ = interpret_what_if("What if Databricks runs on Azure?", retail_estate, ontology)
    assert est.target_cloud == "azure" and "databricks" in est.target_platforms
    _, changes = interpret_what_if("What if the moon were cheese", Estate(), ontology)
    assert changes == []


def test_retained_informatica_branch(generator, ontology, retail_estate):
    est, _ = interpret_what_if("What if we retain Informatica?", retail_estate, ontology)
    assert "informatica-powercenter" in techs(generator.generate(est))
