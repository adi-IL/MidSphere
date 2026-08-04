"""Consumer Gate — MidSphere policy, not platform-wide MCP denial."""

from __future__ import annotations

from models.artifacts import GateDecision, JobArtifact


def evaluate_from_job(urn: str, job: JobArtifact | None) -> GateDecision:
    if job is None or job.quarantine is None:
        return GateDecision(
            urn=urn,
            status="OPEN",
            reason="No quarantine metadata for entity",
        )

    q = job.quarantine
    if urn in q.entityUrns and q.gateStatus == "BLOCKED":
        return GateDecision(
            urn=urn,
            status="BLOCKED",
            reason="Advisory quarantine: tag QUARANTINED / gate_status=BLOCKED",
            job_id=job.job_id,
            pr_url=(job.pr or {}).get("url"),
            mbom_urn=(job.mbom or {}).get("document_urn"),
            risk_score=float(job.blast_radius.get("risk_score") or 0),
        )

    if q.gateStatus == "LIFTED":
        return GateDecision(
            urn=urn,
            status="LIFTED",
            reason="Quarantine lifted after remediation",
            job_id=job.job_id,
        )

    return GateDecision(
        urn=urn,
        status="OPEN",
        reason="Entity not in active quarantine set",
        job_id=job.job_id,
    )
