from __future__ import annotations

from fastapi import APIRouter, HTTPException

from agents.pipeline import URN_BILLING, lift_quarantine, run_closed_loop
from app.settings import get_settings
from gate.service import GATE_POLICY, evaluate_from_job
from mcp.client import build_client_from_env
from models.artifacts import CreateJobRequest, GateDecision, JobArtifact, LiftRequest

router = APIRouter()

_JOBS: dict[str, JobArtifact] = {}
_LATEST: str | None = None

DEFAULT_ROOT = (
    "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)"
)


def _store(job: JobArtifact) -> JobArtifact:
    global _LATEST
    _JOBS[job.job_id] = job
    _LATEST = job.job_id
    return job


@router.get("/health")
def health() -> dict:
    s = get_settings()
    client = build_client_from_env()
    probe = client.probe()
    return {
        "status": "ok",
        "datahub": s.datahub_gms_url,
        "datahub_reachable": probe.reachable,
        "datahub_detail": probe.detail,
        "mode": "closed_loop",
        "tier": s.datahub_tier,
        "gate_policy": GATE_POLICY,
        "mutations_env": probe.mutations_enabled,
    }


@router.post("/jobs", response_model=JobArtifact)
def create_job(body: CreateJobRequest) -> JobArtifact:
    job = run_closed_loop(body.root_urn, mode=body.mode, auto_trip=body.auto_trip)
    return _store(job)


@router.get("/jobs/latest", response_model=JobArtifact)
def latest_job() -> JobArtifact:
    global _LATEST
    if not _LATEST or _LATEST not in _JOBS:
        job = run_closed_loop(DEFAULT_ROOT)
        return _store(job)
    return _JOBS[_LATEST]


@router.get("/jobs/{job_id}", response_model=JobArtifact)
def get_job(job_id: str) -> JobArtifact:
    if job_id not in _JOBS:
        raise HTTPException(status_code=404, detail="job not found")
    return _JOBS[job_id]


@router.post("/jobs/{job_id}/lift", response_model=JobArtifact)
def lift_job(job_id: str, body: LiftRequest | None = None) -> JobArtifact:
    if job_id not in _JOBS:
        raise HTTPException(status_code=404, detail="job not found")
    urns = body.entity_urns if body else None
    job = lift_quarantine(_JOBS[job_id], entity_urns=urns)
    _JOBS[job_id] = job
    return job


@router.post("/jobs/{job_id}/trip", response_model=JobArtifact)
def trip_job(job_id: str) -> JobArtifact:
    """Re-run closed loop with auto_trip for same root (manual trip path)."""
    if job_id not in _JOBS:
        raise HTTPException(status_code=404, detail="job not found")
    prev = _JOBS[job_id]
    job = run_closed_loop(prev.root_urn, mode="full", auto_trip=True)
    return _store(job)


@router.get("/gate/{urn:path}", response_model=GateDecision)
def gate(urn: str) -> GateDecision:
    job = _JOBS.get(_LATEST) if _LATEST else None
    return evaluate_from_job(urn, job)


@router.get("/gate-default-blocked", response_model=GateDecision)
def gate_default_blocked() -> GateDecision:
    """Convenience: gate for healthcare mart_billing after latest job."""
    job = _JOBS.get(_LATEST) if _LATEST else None
    if job is None:
        job = _store(run_closed_loop(DEFAULT_ROOT))
    return evaluate_from_job(URN_BILLING, job)
