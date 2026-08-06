"""Unit tests against shipped pipeline + gate (real functions)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure backend root on path
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

os.environ["USE_OFFICIAL_MCP"] = "false"
os.environ["ANTIGRAVITY_ENABLED"] = "false"

from agents.pipeline import (  # noqa: E402
    URN_BILLING,
    URN_DEMOGRAPHICS,
    assert_telemetry_mcp_clean,
    compute_risk_score,
    extract_tool_names_from_events,
    lift_quarantine,
    run_closed_loop,
)
from gate.service import GATE_POLICY, evaluate_from_job  # noqa: E402
from midsphere_mcp.client import REAL_MCP_TOOLS, McpClient  # noqa: E402


ROOT = "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)"


def test_risk_score_clamped():
    assert 0 <= compute_risk_score(severity="HIGH", downstream_count=3) <= 100
    assert (
        compute_risk_score(
            severity="LOW",
            downstream_count=0,
            has_pii=False,
            has_production_env=False,
        )
        < 50
    )


def test_closed_loop_full_artifact_honest_telemetry():
    client = McpClient(gms_url="http://127.0.0.1:1", token="", timeout=0.2)
    job = run_closed_loop(ROOT, mode="full", auto_trip=True, client=client)

    assert job.status == "succeeded"
    assert job.findings
    assert 0 <= job.blast_radius["risk_score"] <= 100
    nodes = job.blast_radius["nodes"]
    impacted = [n for n in nodes if n["impacted"]]
    not_impacted = [n for n in nodes if not n["impacted"]]
    assert impacted and not_impacted
    assert any(n["name"] == "mart_demographics" and not n["impacted"] for n in nodes)
    assert any(n["name"] == "mart_billing" and n["impacted"] for n in nodes)

    assert job.quarantine is not None
    assert job.quarantine.gateStatus == "BLOCKED"
    assert URN_BILLING in job.quarantine.entityUrns
    assert URN_DEMOGRAPHICS not in job.quarantine.entityUrns
    assert job.pr is not None and (job.pr.get("path") or job.pr.get("url"))
    assert job.mbom is not None
    assert job.execution_mode == "demo_closed_loop"
    assert job.mutations_applied is False
    enrich = job.blast_radius.get("live_enrichment") or {}
    assert enrich.get("live_mcp_reads", 0) == 0
    assert "scenario pack" in str(enrich.get("note", "")).lower()

    # Honesty: demo path must not emit fake live TOOL events
    real_tools = extract_tool_names_from_events(job.events)
    assert real_tools == [], f"demo should not claim live TOOL calls, got {real_tools}"

    sim_msgs = [e.message for e in job.events if e.message.startswith("sim ")]
    assert any("get_lineage" in m for m in sim_msgs)
    assert any("add_tags" in m for m in sim_msgs)
    assert any("save_document" in m for m in sim_msgs)
    assert any("demo_closed_loop" in e.message for e in job.events)

    assert_telemetry_mcp_clean(job.events)


def test_gate_blocked_then_lifted():
    client = McpClient(gms_url="http://127.0.0.1:1", token="", timeout=0.2)
    job = run_closed_loop(ROOT, auto_trip=True, client=client)

    blocked = evaluate_from_job(URN_BILLING, job)
    assert blocked.status == "BLOCKED"
    assert "advisory" in blocked.reason.lower() or "QUARANTINED" in blocked.reason
    policy = blocked.policy or GATE_POLICY
    assert "does not auto-deny" in policy.lower()

    open_demo = evaluate_from_job(URN_DEMOGRAPHICS, job)
    assert open_demo.status != "BLOCKED"

    job2 = lift_quarantine(job, entity_urns=[URN_BILLING], client=client)
    after = evaluate_from_job(URN_BILLING, job2)
    assert after.status != "BLOCKED"
    assert after.status in ("OPEN", "LIFTED")


def test_dry_run_skips_quarantine():
    client = McpClient(gms_url="http://127.0.0.1:1", timeout=0.2)
    job = run_closed_loop(ROOT, mode="dry_run", auto_trip=True, client=client)
    assert job.findings
    assert job.quarantine is None
    decision = evaluate_from_job(URN_BILLING, job)
    assert decision.status == "OPEN"


def test_stage_tools_builder_antigravity_path():
    """Custom tools produce a complete antigravity_closed_loop artifact."""
    from agents.stage_tools import MidSphereJobBuilder
    from models.artifacts import JobEvent

    b = MidSphereJobBuilder(root_urn=ROOT, mode="full", auto_trip=True)
    b.midsphere_context_sentinel_audit(ROOT)
    b.midsphere_cascade_analyzer(max_hops=2)
    b.midsphere_circuit_breaker_trip(True)
    b.midsphere_fix_architect()
    b.midsphere_mbom_engine()
    job = b.to_job(execution_mode="antigravity_closed_loop")

    assert job.status == "succeeded"
    assert job.execution_mode == "antigravity_closed_loop"
    assert job.findings
    assert job.quarantine is not None
    assert URN_BILLING in job.quarantine.entityUrns
    assert URN_DEMOGRAPHICS not in job.quarantine.entityUrns
    assert job.pr is not None and job.mbom is not None

    tools = extract_tool_names_from_events(job.events)
    assert "midsphere_context_sentinel_audit" in tools
    assert "midsphere_cascade_analyzer" in tools
    assert "midsphere_circuit_breaker_trip" in tools
    assert "midsphere_fix_architect" in tools
    assert "midsphere_mbom_engine" in tools
    assert_telemetry_mcp_clean(job.events)

    # ensure_complete_fallback is idempotent when stages already ran
    b2 = MidSphereJobBuilder(root_urn=ROOT, mode="full", auto_trip=True)
    job2 = b2.to_job()  # no tools called  -  ensure_complete fills stages
    assert job2.findings and job2.quarantine
    assert_telemetry_mcp_clean(job2.events)

    # Forbidden invented names still fail
    bad = [
        JobEvent(
            ts="00:00:00.000",
            agent="ContextSentinel",
            kind="TOOL",
            message="datahub_get_lineage fake",
        )
    ]
    try:
        assert_telemetry_mcp_clean(bad)
        raise AssertionError("expected forbidden tool to raise")
    except AssertionError as exc:
        assert "Forbidden" in str(exc) or "datahub_" in str(exc)


def test_scenario_builder_and_fallback_parity():
    """Verify primary MidSphereJobBuilder and fallback pipeline match on risk, quarantine, PR, and MBOM for all scenarios."""
    from agents.stage_tools import MidSphereJobBuilder

    scenarios = {
        "healthcare": (
            "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)",
            61,
            "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)",
        ),
        "ecommerce": (
            "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.raw_customers,PROD)",
            88,
            "urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)",
        ),
        "nyctaxi": (
            "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.raw_yellow_trips,PROD)",
            65,
            "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)",
        ),
    }

    client = McpClient(gms_url="http://127.0.0.1:1", token="", timeout=0.2)
    repo_root = BACKEND.parent

    for name, (root_urn, expected_risk, expected_quarantine_urn) in scenarios.items():
        # Test Antigravity Builder
        b = MidSphereJobBuilder(root_urn=root_urn, mode="full", auto_trip=True)
        b.midsphere_context_sentinel_audit(root_urn)
        b.midsphere_cascade_analyzer(max_hops=2)
        b.midsphere_circuit_breaker_trip(True)
        b.midsphere_fix_architect()
        b.midsphere_mbom_engine()
        bj = b.to_job(execution_mode="antigravity_closed_loop")

        assert bj.blast_radius["risk_score"] == expected_risk, f"{name} builder risk mismatch"
        assert bj.quarantine is not None
        assert expected_quarantine_urn in bj.quarantine.entityUrns, f"{name} builder quarantine mismatch"
        assert bj.pr is not None and bj.pr.get("path")
        assert bj.mbom is not None and bj.mbom.get("path")

        # Test Fallback Pipeline
        fj = run_closed_loop(root_urn, mode="full", auto_trip=True, client=client)
        assert fj.blast_radius["risk_score"] == expected_risk, f"{name} fallback risk mismatch"
        assert fj.quarantine is not None
        assert expected_quarantine_urn in fj.quarantine.entityUrns, f"{name} fallback quarantine mismatch"

        # Verify Artifact Existence
        pr_abs = repo_root / fj.pr["path"]
        mbom_abs = repo_root / fj.mbom["path"]
        assert pr_abs.exists(), f"PR diff artifact missing at {pr_abs}"
        assert mbom_abs.exists(), f"MBOM artifact missing at {mbom_abs}"

