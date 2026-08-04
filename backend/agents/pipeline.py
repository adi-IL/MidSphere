"""Deterministic demo pipeline until live MCP + Antigravity agents land.

Emits real MCP tool names in telemetry. Healthcare selective-halt story.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from models.artifacts import (
    AuditFinding,
    BlastNode,
    JobArtifact,
    JobEvent,
    QuarantineReceipt,
)


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]


def run_demo_pipeline(root_urn: str, mode: str = "full", auto_trip: bool = True) -> JobArtifact:
    job_id = str(uuid.uuid4())
    events: list[JobEvent] = []

    def emit(agent: str, kind: str, message: str) -> None:
        events.append(JobEvent(ts=_ts(), agent=agent, kind=kind, message=message))  # type: ignore[arg-type]

    emit("ContextSentinel", "TOOL", f"get_lineage urn={root_urn} max_hops=2 12ms")
    emit("ContextSentinel", "TOOL", "list_schema_fields urn=…raw_patients")
    emit(
        "ContextSentinel",
        "FIND",
        "NEGATIVE_BILLING severity=HIGH entity=…mart_billing",
    )
    emit("ContextSentinel", "FIND", "DATE_SWAP severity=MEDIUM entity=…raw_patients")

    findings = [
        AuditFinding(
            id="f1",
            type="NEGATIVE_BILLING",
            severity="HIGH",
            entity_urn="urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)",
            column_path="billing_amount",
            evidence="~2% rows with billing_amount < 0 (planted healthcare dataset)",
            rationale="Invalid financial measures poison billing mart aggregates",
        ),
        AuditFinding(
            id="f2",
            type="DATE_SWAP",
            severity="MEDIUM",
            entity_urn="urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)",
            column_path="date_of_admission",
            evidence="admission after discharge on subset of rows",
            rationale="Produces negative length_of_stay in billing path",
        ),
    ]

    nodes = [
        BlastNode(
            urn="urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)",
            name="raw_patients",
            hop=0,
            impacted=True,
            reason="Source of planted quality issues",
        ),
        BlastNode(
            urn="urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.staging_patients,PROD)",
            name="staging_patients",
            hop=1,
            impacted=True,
            reason="Propagates source issues",
        ),
        BlastNode(
            urn="urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)",
            name="mart_billing",
            hop=2,
            impacted=True,
            reason="NEGATIVE_BILLING + DATE_SWAP cascade",
        ),
        BlastNode(
            urn="urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_demographics,PROD)",
            name="mart_demographics",
            hop=2,
            impacted=False,
            reason="Not affected by this finding set (selective halt)",
        ),
    ]
    risk = 72
    emit("CascadeAnalyzer", "TOOL", "get_lineage downstream max_hops=2")
    emit("CascadeAnalyzer", "SCORE", f"risk={risk} selective=true billing=yes demographics=no")

    quarantine = None
    pr = None
    mbom = None

    if mode != "dry_run" and auto_trip:
        emit(
            "CircuitBreaker",
            "TOOL",
            "add_tags tag_urns=[QUARANTINED,CIRCUIT_BROKEN] entity_urns=1",
        )
        emit("CircuitBreaker", "WRITE", "add_structured_properties gate_status=BLOCKED")
        quarantine = QuarantineReceipt(
            entityUrns=[
                "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)"
            ],
            tagsApplied=[
                "urn:li:tag:QUARANTINED",
                "urn:li:tag:CIRCUIT_BROKEN",
                "urn:li:tag:MIDSPHERE_AUDIT",
            ],
            properties={
                "midsphere.gate_status": "BLOCKED",
                "midsphere.risk_score": str(risk),
                "midsphere.job_id": job_id,
            },
            gateStatus="BLOCKED",
        )
        emit("FixArchitect", "TOOL", "get_dataset_queries urn=…staging_patients")
        emit(
            "FixArchitect",
            "PR",
            "dry_run path=examples/prs/fix-negative-billing.example.diff",
        )
        pr = {
            "status": "dry_run",
            "path": "examples/prs/fix-negative-billing.example.diff",
        }
        emit("MBOMEngine", "TOOL", "save_document type=Analysis related_assets=1")
        emit("MBOMEngine", "MBOM", "urn:li:document:midsphere-mbom-example")
        mbom = {
            "document_urn": "urn:li:document:midsphere-mbom-example",
            "path": "examples/mboms/healthcare-billing-mbom.example.md",
        }

    return JobArtifact(
        job_id=job_id,
        root_urn=root_urn,
        mode=mode,
        status="succeeded",
        findings=findings,
        blast_radius={
            "risk_score": risk,
            "nodes": [n.model_dump() for n in nodes],
        },
        quarantine=quarantine,
        pr=pr,
        mbom=mbom,
        events=events,
    )
