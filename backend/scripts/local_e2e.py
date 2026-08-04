#!/usr/bin/env python3
"""Drive real HTTP entrypoints against a running uvicorn (or TestClient)."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

DEFAULT_ROOT = (
    "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)"
)
URN_BILLING = (
    "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)"
)


def run_once(base: str) -> dict:
    c = httpx.Client(base_url=base, timeout=30.0)
    health = c.get("/v1/health").json()
    assert health.get("status") == "ok", health

    job = c.post(
        "/v1/jobs",
        json={"root_urn": DEFAULT_ROOT, "mode": "full", "auto_trip": True},
    ).json()
    assert job.get("status") == "succeeded", job
    assert job.get("findings"), job
    assert job.get("blast_radius", {}).get("risk_score") is not None
    assert job.get("quarantine", {}).get("gateStatus") == "BLOCKED"
    assert job.get("pr")
    assert job.get("mbom")

    gate_b = c.get(f"/v1/gate/{URN_BILLING}").json()
    assert gate_b.get("status") == "BLOCKED", gate_b

    lifted = c.post(f"/v1/jobs/{job['job_id']}/lift", json={}).json()
    gate_a = c.get(f"/v1/gate/{URN_BILLING}").json()
    assert gate_a.get("status") != "BLOCKED", gate_a

    return {
        "health": health,
        "job": {
            "job_id": job["job_id"],
            "status": job["status"],
            "findings_count": len(job["findings"]),
            "risk_score": job["blast_radius"]["risk_score"],
            "quarantine": job["quarantine"],
            "pr": job["pr"],
            "mbom": job["mbom"],
            "execution_mode": job.get("execution_mode"),
            "mutations_applied": job.get("mutations_applied"),
            "events_sample": [e["message"] for e in job.get("events", [])[:8]],
        },
        "gate_blocked": gate_b,
        "gate_after_lift": gate_a,
        "lifted_gate_status": lifted.get("quarantine", {}).get("gateStatus"),
    }


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("e2e-out.json")
    # wait for server
    for _ in range(40):
        try:
            r = httpx.get(f"{base}/v1/health", timeout=1.0)
            if r.status_code == 200:
                break
        except Exception:
            time.sleep(0.25)
    else:
        print("server not up", file=sys.stderr)
        return 1

    payload = run_once(base)
    out_path.write_text(json.dumps(payload, indent=2))
    print(json.dumps({"ok": True, "out": str(out_path), "job_id": payload["job"]["job_id"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
