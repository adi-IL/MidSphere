from __future__ import annotations

from fastapi import APIRouter, HTTPException

from agents.pipeline import run_demo_pipeline
from app.settings import get_settings
from gate.service import evaluate_from_job
from models.artifacts import CreateJobRequest, GateDecision, JobArtifact

router = APIRouter()

# In-memory job store (swap for Redis/DB later)
_JOBS: dict[str, JobArtifact] = {}
_LATEST: str | None = None


@router.get("/health")
def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "datahub": s.datahub_gms_url,
        "mode": "demo_pipeline",
        "tier": s.datahub_tier,
    }


@router.post("/jobs", response_model=JobArtifact)
def create_job(body: CreateJobRequest) -> JobArtifact:
    global _LATEST
    job = run_demo_pipeline(body.root_urn, mode=body.mode, auto_trip=body.auto_trip)
    _JOBS[job.job_id] = job
    _LATEST = job.job_id
    return job


@router.get("/jobs/latest", response_model=JobArtifact)
def latest_job() -> JobArtifact:
    global _LATEST
    if not _LATEST or _LATEST not in _JOBS:
        # Seed a demo job so the Command Center has data offline-friendly
        job = run_demo_pipeline(
            "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)"
        )
        _JOBS[job.job_id] = job
        _LATEST = job.job_id
        return job
    return _JOBS[_LATEST]


@router.get("/jobs/{job_id}", response_model=JobArtifact)
def get_job(job_id: str) -> JobArtifact:
    if job_id not in _JOBS:
        raise HTTPException(status_code=404, detail="job not found")
    return _JOBS[job_id]


@router.get("/gate/{urn:path}", response_model=GateDecision)
def gate(urn: str) -> GateDecision:
    job = _JOBS.get(_LATEST) if _LATEST else None
    return evaluate_from_job(urn, job)
