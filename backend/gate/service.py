"""Consumer Gate — MidSphere policy, not platform-wide MCP auto-denial."""

from __future__ import annotations

from models.artifacts import GateDecision, JobArtifact

GATE_POLICY = (
    "MidSphere Consumer Gate enforces BLOCKED for MidSphere-aware clients. "
    "Quarantine is advisory graph state (tags/structured properties) in DataHub; "
    "MCP does not auto-deny all third-party agents."
)


def evaluate_from_job(urn: str, job: JobArtifact | None) -> GateDecision:
    if job is None or job.quarantine is None:
        return GateDecision(
            urn=urn,
            status="OPEN",
            reason="No quarantine metadata for entity",
            policy=GATE_POLICY,
        )

    q = job.quarantine
    if urn in q.entityUrns and q.gateStatus == "BLOCKED":
        return GateDecision(
            urn=urn,
            status="BLOCKED",
            reason=(
                "Advisory quarantine: tag QUARANTINED / gate_status=BLOCKED "
                "(MidSphere Consumer Gate policy — not platform-wide MCP denial)"
            ),
            job_id=job.job_id,
            pr_url=(job.pr or {}).get("url"),
            mbom_urn=(job.mbom or {}).get("document_urn"),
            risk_score=float(job.blast_radius.get("risk_score") or 0),
            policy=GATE_POLICY,
        )

    if q.gateStatus == "LIFTED" or (
        urn not in q.entityUrns and q.gateStatus in ("LIFTED", "BLOCKED", "OPEN")
    ):
        # Lifted or never in active set after reverse
        if q.gateStatus == "LIFTED" or urn not in q.entityUrns:
            status = "LIFTED" if q.gateStatus == "LIFTED" and not q.entityUrns else "OPEN"
            # After selective lift of this urn, OPEN/LIFTED — never BLOCKED
            if urn not in q.entityUrns:
                return GateDecision(
                    urn=urn,
                    status="LIFTED" if q.gateStatus == "LIFTED" else "OPEN",
                    reason=(
                        "Quarantine lifted or entity not in active BLOCKED set"
                        if q.gateStatus == "LIFTED" or status == "LIFTED"
                        else "Entity not in active quarantine set"
                    ),
                    job_id=job.job_id,
                    policy=GATE_POLICY,
                )

    return GateDecision(
        urn=urn,
        status="OPEN",
        reason="Entity not in active quarantine set",
        job_id=job.job_id,
        policy=GATE_POLICY,
    )
