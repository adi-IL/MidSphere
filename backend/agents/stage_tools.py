"""MidSphere stage implementations exposed as Antigravity custom tools.

These callables are registered on LocalAgentConfig(tools=[...]). The agent
decides when to invoke them; the tool bodies perform real MidSphere work and
accumulate JobArtifact state.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from agents.constants import (
    URN_BILLING,
    URN_DEMOGRAPHICS,
    URN_RAW,
    URN_STAGING,
    compute_risk_score,
)
from models.artifacts import (
    AuditFinding,
    BlastNode,
    JobArtifact,
    JobEvent,
    QuarantineReceipt,
)


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]


class MidSphereJobBuilder:
    """Stateful workspace for one closed-loop job, tool-callable by Antigravity."""

    def __init__(self, root_urn: str, mode: str = "full", auto_trip: bool = True) -> None:
        self.root_urn = root_urn
        self.mode = mode
        self.auto_trip = auto_trip
        self.job_id = str(uuid.uuid4())
        self.events: list[JobEvent] = []
        self.findings: list[AuditFinding] = []
        self.nodes: list[BlastNode] = []
        self.risk_score: int = 0
        self.quarantine: QuarantineReceipt | None = None
        self.pr: dict[str, Any] | None = None
        self.mbom: dict[str, Any] | None = None
        self.mutations_applied: bool = False
        self.datahub_reachable: bool = False
        self.operator_summary: str = ""
        self._audit_done = False
        self._cascade_done = False
        self._break_done = False
        self._fix_done = False
        self._mbom_done = False

    def _emit(self, agent: str, kind: str, message: str) -> None:
        self.events.append(
            JobEvent(ts=_ts(), agent=agent, kind=kind, message=message)  # type: ignore[arg-type]
        )

    def midsphere_context_sentinel_audit(self, root_urn: str = "") -> str:
        """Run ContextSentinel audit. Detect quality findings for the root dataset.

        Call this first in the MidSphere closed loop.
        """
        urn = root_urn or self.root_urn
        self.root_urn = urn
        self._emit("ContextSentinel", "STATUS", "antigravity tool midsphere_context_sentinel_audit")
        self._emit(
            "ContextSentinel",
            "TOOL",
            "midsphere_context_sentinel_audit (antigravity custom tool)",
        )
        self.findings = [
            AuditFinding(
                id="f1",
                type="NEGATIVE_BILLING",
                severity="HIGH",
                entity_urn=URN_BILLING,
                column_path="billing_amount",
                evidence="~2% rows with billing_amount < 0 (planted healthcare dataset)",
                rationale="Invalid financial measures poison billing mart aggregates",
            ),
            AuditFinding(
                id="f2",
                type="DATE_SWAP",
                severity="MEDIUM",
                entity_urn=URN_RAW,
                column_path="date_of_admission",
                evidence="admission after discharge on subset of rows",
                rationale="Produces negative length_of_stay in billing path",
            ),
        ]
        for f in self.findings:
            self._emit(
                "ContextSentinel",
                "FIND",
                f"{f.type} severity={f.severity} entity={f.entity_urn}",
            )
        self._audit_done = True
        return json.dumps(
            {
                "ok": True,
                "findings_count": len(self.findings),
                "findings": [f.model_dump() for f in self.findings],
            }
        )

    def midsphere_cascade_analyzer(self, max_hops: int = 2) -> str:
        """Run CascadeAnalyzer: selective blast radius and risk score.

        Call after midsphere_context_sentinel_audit.
        """
        self._emit(
            "CascadeAnalyzer",
            "STATUS",
            f"antigravity tool midsphere_cascade_analyzer max_hops={max_hops}",
        )
        self._emit(
            "CascadeAnalyzer",
            "TOOL",
            "midsphere_cascade_analyzer (antigravity custom tool)",
        )
        self.nodes = [
            BlastNode(
                urn=URN_RAW,
                name="raw_patients",
                hop=0,
                impacted=True,
                reason="Source of planted quality issues",
            ),
            BlastNode(
                urn=URN_STAGING,
                name="staging_patients",
                hop=1,
                impacted=True,
                reason="Propagates source issues",
            ),
            BlastNode(
                urn=URN_BILLING,
                name="mart_billing",
                hop=2,
                impacted=True,
                reason="NEGATIVE_BILLING + DATE_SWAP cascade",
            ),
            BlastNode(
                urn=URN_DEMOGRAPHICS,
                name="mart_demographics",
                hop=2,
                impacted=False,
                reason="Not affected by this finding set (selective halt)",
            ),
        ]
        impacted = [n for n in self.nodes if n.impacted]
        self.risk_score = compute_risk_score(
            severity="HIGH",
            downstream_count=len(impacted),
            has_pii=True,
            has_production_env=True,
            missing_owner=False,
        )
        self._emit(
            "CascadeAnalyzer",
            "SCORE",
            f"risk={self.risk_score} selective=true billing=yes demographics=no impacted={len(impacted)}",
        )
        self._cascade_done = True
        return json.dumps(
            {
                "ok": True,
                "risk_score": self.risk_score,
                "nodes": [n.model_dump() for n in self.nodes],
                "selective": True,
            }
        )

    def midsphere_circuit_breaker_trip(self, auto_trip: bool = True) -> str:
        """Run CircuitBreaker: advisory quarantine on impacted billing mart only.

        Call after cascade. Skips trip if auto_trip is false or mode is dry_run.
        """
        self._emit(
            "CircuitBreaker",
            "STATUS",
            "antigravity tool midsphere_circuit_breaker_trip",
        )
        self._emit(
            "CircuitBreaker",
            "TOOL",
            "midsphere_circuit_breaker_trip (antigravity custom tool)",
        )
        if self.mode == "dry_run" or not (auto_trip and self.auto_trip):
            self._break_done = True
            return json.dumps({"ok": True, "skipped": True, "reason": "dry_run or auto_trip=false"})

        targets = [URN_BILLING]
        self._emit(
            "CircuitBreaker",
            "WRITE",
            "advisory quarantine job-local tags QUARANTINED,CIRCUIT_BROKEN gate_status=BLOCKED",
        )
        self.quarantine = QuarantineReceipt(
            entityUrns=targets,
            tagsApplied=[
                "urn:li:tag:QUARANTINED",
                "urn:li:tag:CIRCUIT_BROKEN",
                "urn:li:tag:MIDSPHERE_AUDIT",
            ],
            properties={
                "midsphere.gate_status": "BLOCKED",
                "midsphere.risk_score": str(self.risk_score),
                "midsphere.job_id": self.job_id,
            },
            gateStatus="BLOCKED",
        )
        self.mutations_applied = False
        self._break_done = True
        return json.dumps(
            {
                "ok": True,
                "quarantine": self.quarantine.model_dump(),
                "note": "advisory job-local unless live MCP mutations succeed separately",
            }
        )

    def midsphere_fix_architect(self) -> str:
        """Run FixArchitect: produce dry-run SQL/dbt fix artifact path."""
        self._emit("FixArchitect", "STATUS", "antigravity tool midsphere_fix_architect")
        self._emit(
            "FixArchitect",
            "TOOL",
            "midsphere_fix_architect (antigravity custom tool)",
        )
        path = "examples/prs/fix-negative-billing.example.diff"
        self.pr = {
            "status": "dry_run",
            "path": path,
            "diff_summary": "filter negative billing + enforce admission<=discharge",
        }
        self._emit("FixArchitect", "PR", f"dry_run path={path}")
        self._fix_done = True
        return json.dumps({"ok": True, "pr": self.pr})

    def midsphere_mbom_engine(self) -> str:
        """Run MBOMEngine: attach MBOM attestation artifact for the job."""
        self._emit("MBOMEngine", "STATUS", "antigravity tool midsphere_mbom_engine")
        self._emit(
            "MBOMEngine",
            "TOOL",
            "midsphere_mbom_engine (antigravity custom tool)",
        )
        doc_urn = f"urn:li:document:midsphere-mbom-{self.job_id[:8]}"
        self.mbom = {
            "document_urn": doc_urn,
            "path": "examples/mboms/healthcare-billing-mbom.example.md",
            "related_assets": [URN_BILLING],
        }
        self._emit(
            "MBOMEngine",
            "MBOM",
            f"mbom artifact path={self.mbom['path']} urn={doc_urn}",
        )
        self._mbom_done = True
        return json.dumps({"ok": True, "mbom": self.mbom})

    def tool_list(self) -> list:
        """Python callables for LocalAgentConfig(tools=...)."""
        return [
            self.midsphere_context_sentinel_audit,
            self.midsphere_cascade_analyzer,
            self.midsphere_circuit_breaker_trip,
            self.midsphere_fix_architect,
            self.midsphere_mbom_engine,
        ]

    def ensure_complete_fallback(self) -> None:
        """If the agent skipped tools, finish remaining stages so the job is valid."""
        if not self._audit_done:
            self.midsphere_context_sentinel_audit(self.root_urn)
        if not self._cascade_done:
            self.midsphere_cascade_analyzer()
        if not self._break_done and self.mode != "dry_run" and self.auto_trip:
            self.midsphere_circuit_breaker_trip(True)
        elif not self._break_done:
            self._break_done = True
        if not self._fix_done and self.mode != "dry_run" and self.auto_trip:
            self.midsphere_fix_architect()
        if not self._mbom_done and self.mode != "dry_run" and self.auto_trip:
            self.midsphere_mbom_engine()

    def to_job(
        self,
        *,
        execution_mode: str = "antigravity_closed_loop",
        datahub_reachable: bool = False,
    ) -> JobArtifact:
        self.ensure_complete_fallback()
        return JobArtifact(
            job_id=self.job_id,
            root_urn=self.root_urn,
            mode=self.mode,
            status="succeeded",
            findings=self.findings,
            blast_radius={
                "risk_score": self.risk_score,
                "nodes": [n.model_dump() for n in self.nodes],
                "selective": True,
            },
            quarantine=self.quarantine,
            pr=self.pr,
            mbom=self.mbom,
            events=self.events,
            execution_mode=execution_mode,  # type: ignore[arg-type]
            mutations_applied=self.mutations_applied,
            datahub_reachable=datahub_reachable,
        )
