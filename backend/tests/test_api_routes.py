"""API route honesty: no auto-pipeline on GET /jobs/latest; health MCP probe shape."""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

os.environ["USE_OFFICIAL_MCP"] = "false"
os.environ["ANTIGRAVITY_ENABLED"] = "false"
os.environ["HEALTH_PROBE_OFFICIAL_MCP"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
import api.routes as routes  # noqa: E402


def setup_function() -> None:
    routes._JOBS.clear()
    routes._LATEST = None


def test_jobs_latest_404_when_empty_no_side_effect():
    client = TestClient(app)
    before = len(routes._JOBS)
    r = client.get("/v1/jobs/latest")
    assert r.status_code == 404
    assert len(routes._JOBS) == before
    assert routes._LATEST is None


def test_jobs_latest_returns_stored_job():
    client = TestClient(app)
    created = client.post(
        "/v1/jobs",
        json={
            "root_urn": routes.DEFAULT_ROOT,
            "mode": "full",
            "auto_trip": True,
        },
    )
    assert created.status_code == 200
    job_id = created.json()["job_id"]
    r = client.get("/v1/jobs/latest")
    assert r.status_code == 200
    assert r.json()["job_id"] == job_id


def test_health_official_mcp_not_probed_by_default():
    client = TestClient(app)
    r = client.get("/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    mcp = body["official_mcp"]
    assert mcp.get("probed") is False
    assert mcp.get("ok") is None


def test_gate_default_blocked_empty_store_is_open():
    client = TestClient(app)
    r = client.get("/v1/gate-default-blocked")
    assert r.status_code == 200
    assert r.json()["status"] == "OPEN"
    assert routes._LATEST is None


def test_scenario_root_urns_match_packs():
    """Frontend SCENARIOS must use the same roots as scenario packs (regression)."""
    from agents.scenarios import get_scenario_spec

    ecom = "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.raw_customers,PROD)"
    taxi = "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.raw_yellow_trips,PROD)"
    se = get_scenario_spec(ecom)
    st = get_scenario_spec(taxi)
    assert se["scenario"] == "ecommerce"
    assert se["nodes"][0].name == "raw_customers"
    assert st["scenario"] == "nyctaxi"
    assert st["nodes"][0].name == "raw_yellow_trips"
    # Wrong legacy FE names still keyword-match, but root would disagree with hop0
    wrong = get_scenario_spec(
        "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.raw_orders,PROD)"
    )
    assert wrong["scenario"] == "ecommerce"
    assert wrong["nodes"][0].name == "raw_customers"
