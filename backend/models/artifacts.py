from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


Severity = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
GateStatus = Literal["OPEN", "BLOCKED", "LIFTED"]
EventKind = Literal["TOOL", "FIND", "SCORE", "WRITE", "PR", "MBOM", "ERROR", "STATUS"]


class AuditFinding(BaseModel):
    id: str
    type: str
    severity: Severity
    entity_urn: str
    column_path: str | None = None
    evidence: str
    rationale: str


class BlastNode(BaseModel):
    urn: str
    name: str
    hop: int
    impacted: bool
    reason: str | None = None


class QuarantineReceipt(BaseModel):
    entityUrns: list[str]
    tagsApplied: list[str]
    properties: dict[str, str]
    incidentUrn: str | None = None
    gateStatus: GateStatus


class JobEvent(BaseModel):
    ts: str
    agent: str
    kind: EventKind
    message: str
    payload: Any | None = None


class JobArtifact(BaseModel):
    job_id: str
    root_urn: str
    mode: str
    status: str
    findings: list[AuditFinding] = Field(default_factory=list)
    blast_radius: dict[str, Any] = Field(default_factory=lambda: {"risk_score": 0, "nodes": []})
    quarantine: QuarantineReceipt | None = None
    pr: dict[str, Any] | None = None
    mbom: dict[str, Any] | None = None
    events: list[JobEvent] = Field(default_factory=list)


class CreateJobRequest(BaseModel):
    root_urn: str
    mode: str = "full"
    auto_trip: bool = True


class GateDecision(BaseModel):
    urn: str
    status: GateStatus
    reason: str
    job_id: str | None = None
    pr_url: str | None = None
    mbom_urn: str | None = None
    risk_score: float | None = None
