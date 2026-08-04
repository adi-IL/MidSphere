"""Unit tests against shipped pipeline + gate (real functions, no reimplementation)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Ensure backend root on path
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

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
    assert compute_risk_score(severity="LOW", downstream_count=0, has_pii=False, has_production_env=False) < 50


def test_closed_loop_full_artifact():
    # Force demo mode: unreachable GMS
    client = McpClient(gms_url="http://127.0.0.1:1", token="", timeout=0.2)
    job = run_closed_loop(ROOT, mode="full", auto_trip=True, client=client)

    assert job.status == "succeeded"
    assert job.findings, "findings must be non-empty"
    assert 0 <= job.blast_radius["risk_score"] <= 100
    nodes = job.blast_radius["nodes"]
    impacted = [n for n in nodes if n["impacted"]]
    not_impacted = [n for n in nodes if not n["impacted"]]
    assert impacted, "need selective impacted path"
    assert not_impacted, "need selective non-impacted path (demographics)"
    assert any(n["name"] == "mart_demographics" and not n["impacted"] for n in nodes)
    assert any(n["name"] == "mart_billing" and n["impacted"] for n in nodes)

    assert job.quarantine is not None
    assert job.quarantine.gateStatus == "BLOCKED"
    assert URN_BILLING in job.quarantine.entityUrns
    assert URN_DEMOGRAPHICS not in job.quarantine.entityUrns

    assert job.pr is not None
    assert job.pr.get("path") or job.pr.get("url")
    assert job.mbom is not None
    assert job.mbom.get("document_urn") or job.mbom.get("path")

    assert job.execution_mode == "demo_closed_loop"
    assert job.mutations_applied is False

    tools = extract_tool_names_from_events(job.events)
    assert "get_lineage" in tools
    assert "add_tags" in tools
    assert "save_document" in tools
    assert_telemetry_mcp_clean(job.events)
    for t in tools:
        assert not t.startswith("datahub_")
        assert t != "create_incident"
        assert t in REAL_MCP_TOOLS


def test_gate_blocked_then_lifted():
    client = McpClient(gms_url="http://127.0.0.1:1", token="", timeout=0.2)
    job = run_closed_loop(ROOT, auto_trip=True, client=client)

    blocked = evaluate_from_job(URN_BILLING, job)
    assert blocked.status == "BLOCKED"
    assert "advisory" in blocked.reason.lower() or "QUARANTINED" in blocked.reason
    assert "auto-deny" in (blocked.policy or GATE_POLICY).lower() or "does not auto-deny" in (
        blocked.policy or GATE_POLICY
    )
    # Must not claim platform-wide MCP denial as the mechanism
    assert "auto-deny all" in (blocked.policy or "").lower() or "does not auto-deny" in (
        blocked.policy or GATE_POLICY
    ).lower()

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
