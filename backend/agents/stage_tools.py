"""MidSphere stage implementations exposed as Antigravity custom tools.

These callables are registered on LocalAgentConfig(tools=[...]). The agent
decides when to invoke them; tool bodies use shared scenario packs
(agents/scenarios.py) and accumulate JobArtifact state.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from agents.scenarios import get_scenario_spec
from models.artifacts import (
    AuditFinding,
    BlastNode,
    JobArtifact,
    JobEvent,
    QuarantineReceipt,
)


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]


# Back-compat alias for tests/imports that used the private name
def _get_scenario_spec(root_urn: str) -> dict[str, Any]:
    return get_scenario_spec(root_urn)


def _mutations_enabled() -> bool:
    return os.environ.get("TOOLS_IS_MUTATION_ENABLED", "false").lower() in (
        "1",
        "true",
        "yes",
    )


def _try_official_mcp(
    tool_calls: list[tuple[str, dict[str, Any]]],
    *,
    mutations: bool,
) -> list[dict[str, Any]]:
    """Best-effort official MCP calls. Returns per-call dicts; empty on total failure."""
    try:
        from midsphere_mcp.client import build_client_from_env
        from midsphere_mcp.official import call_official_mcp

        probe = build_client_from_env().probe()
        if not probe.reachable:
            return []
        s_url = os.environ.get("DATAHUB_GMS_URL", "http://localhost:8080")
        s_tok = os.environ.get("DATAHUB_GMS_TOKEN", "")
        live = call_official_mcp(
            s_url,
            s_tok,
            mutations=mutations,
            tool_calls=tool_calls,
            timeout=90.0,
        )
        return list(live.calls or [])
    except Exception:  # noqa: BLE001
        return []


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

    def midsphere_context_sentinel_audit(self, root_urn: str = "", **kwargs: Any) -> str:
        """Run ContextSentinel audit. Detect quality findings for the root dataset.

        Call this first in the MidSphere closed loop.
        Prefer live MCP reads (get_lineage / list_schema_fields) when GMS is up;
        scenario packs always ground demo findings for healthcare / ecommerce / nyctaxi.
        """
        urn = root_urn or self.root_urn
        self.root_urn = urn
        self._emit("ContextSentinel", "STATUS", "antigravity tool midsphere_context_sentinel_audit")
        self._emit(
            "ContextSentinel",
            "TOOL",
            "midsphere_context_sentinel_audit (antigravity custom tool)",
        )
        # Primary workforce: real MCP reads when reachable (Antigravity may also call MCP)
        calls = _try_official_mcp(
            [
                (
                    "get_lineage",
                    {"urn": self.root_urn, "upstream": False, "max_hops": 2},
                ),
                ("list_schema_fields", {"urn": self.root_urn}),
            ],
            mutations=False,
        )
        for c in calls:
            if c.get("ok"):
                self._emit(
                    "ContextSentinel",
                    "TOOL",
                    f"{c.get('tool')} official_mcp ok",
                )
            elif c.get("tool"):
                self._emit(
                    "ContextSentinel",
                    "STATUS",
                    f"official_mcp {c.get('tool')} fail {str(c.get('error', ''))[:100]}",
                )

        spec = _get_scenario_spec(self.root_urn)
        self.findings = list(spec["findings"])

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
                "live_mcp_reads": len([c for c in calls if c.get("ok")]),
            }
        )

    def midsphere_cascade_analyzer(self, max_hops: int = 2, **kwargs: Any) -> str:
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
        spec = _get_scenario_spec(self.root_urn)
        self.nodes = spec["nodes"]
        self.risk_score = spec["risk_score"]

        impacted = [n for n in self.nodes if n.impacted]
        self._emit(
            "CascadeAnalyzer",
            "SCORE",
            f"risk={self.risk_score} selective=true impacted={len(impacted)}",
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

    def midsphere_circuit_breaker_trip(self, auto_trip: bool = True, **kwargs: Any) -> str:
        """Run CircuitBreaker: advisory quarantine on impacted target mart.

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

        spec = _get_scenario_spec(self.root_urn)
        targets = list(spec["target_urns"])
        tags = list(
            spec.get("quarantine_tags")
            or [
                "urn:li:tag:QUARANTINED",
                "urn:li:tag:CIRCUIT_BROKEN",
                "urn:li:tag:MIDSPHERE_AUDIT",
            ]
        )
        # Prefer real MCP mutation tools (primary priority when GMS + mutations enabled)
        wrote_live = False
        if _mutations_enabled():
            tag_urns = [t if t.startswith("urn:") else f"urn:li:tag:{t}" for t in tags]
            # Official add_tags expects tag URNs
            calls = _try_official_mcp(
                [
                    (
                        "add_tags",
                        {
                            "tag_urns": [
                                "urn:li:tag:QUARANTINED",
                                "urn:li:tag:CIRCUIT_BROKEN",
                            ],
                            "entity_urns": targets,
                        },
                    ),
                ],
                mutations=True,
            )
            for c in calls:
                if c.get("ok"):
                    wrote_live = True
                    self.mutations_applied = True
                    self._emit(
                        "CircuitBreaker",
                        "TOOL",
                        f"{c.get('tool')} official_mcp ok",
                    )
                    self._emit(
                        "CircuitBreaker",
                        "WRITE",
                        "add_tags applied via official mcp-server-datahub",
                    )
                elif c.get("tool"):
                    self._emit(
                        "CircuitBreaker",
                        "STATUS",
                        f"official_mcp {c.get('tool')} fail {str(c.get('error', ''))[:120]}",
                    )

        if not wrote_live:
            self._emit(
                "CircuitBreaker",
                "WRITE",
                "advisory quarantine job-local tags QUARANTINED,CIRCUIT_BROKEN gate_status=BLOCKED",
            )
            self._emit(
                "CircuitBreaker",
                "STATUS",
                "job-local quarantine (GMS offline, mutations disabled, or live write failed)",
            )
            self.mutations_applied = False

        self.quarantine = QuarantineReceipt(
            entityUrns=targets,
            tagsApplied=tags,
            properties={
                "midsphere.gate_status": "BLOCKED",
                "midsphere.risk_score": str(self.risk_score),
                "midsphere.job_id": self.job_id,
            },
            gateStatus="BLOCKED",
        )
        self._break_done = True
        return json.dumps(
            {
                "ok": True,
                "quarantine": self.quarantine.model_dump(),
                "mutations_applied": self.mutations_applied,
                "note": (
                    "live MCP tags applied"
                    if wrote_live
                    else "advisory job-local; enable TOOLS_IS_MUTATION_ENABLED + reachable GMS for graph write-back"
                ),
            }
        )

    def midsphere_fix_architect(self, **kwargs: Any) -> str:
        """Run FixArchitect: produce dry-run SQL/dbt fix artifact path."""
        self._emit("FixArchitect", "STATUS", "antigravity tool midsphere_fix_architect")
        self._emit(
            "FixArchitect",
            "TOOL",
            "midsphere_fix_architect (antigravity custom tool)",
        )
        spec = _get_scenario_spec(self.root_urn)
        path = spec["pr_path"]
        self.pr = {
            "status": "dry_run",
            "path": path,
            "diff_summary": spec["pr_summary"],
        }
        self._emit("FixArchitect", "PR", f"dry_run path={path}")
        self._fix_done = True
        return json.dumps({"ok": True, "pr": self.pr})

    def midsphere_mbom_engine(self, **kwargs: Any) -> str:
        """Run MBOMEngine: attach MBOM attestation artifact for the job."""
        self._emit("MBOMEngine", "STATUS", "antigravity tool midsphere_mbom_engine")
        self._emit(
            "MBOMEngine",
            "TOOL",
            "midsphere_mbom_engine (antigravity custom tool)",
        )
        spec = _get_scenario_spec(self.root_urn)
        doc_urn = (
            spec["mbom_urn"]
            if "mbom_urn" in spec and "midsphere-mbom-example" not in spec["mbom_urn"]
            else f"urn:li:document:midsphere-mbom-{self.job_id[:8]}"
        )
        targets = list(spec["target_urns"])
        self.mbom = {
            "document_urn": doc_urn,
            "path": spec["mbom_path"],
            "related_assets": targets,
        }
        if _mutations_enabled():
            calls = _try_official_mcp(
                [
                    (
                        "save_document",
                        {
                            "document_type": "Analysis",
                            "title": f"MBOM MidSphere {self.job_id[:8]}",
                            "content": (
                                f"# MBOM\njob={self.job_id}\nrisk={self.risk_score}\n"
                                f"scenario={spec.get('scenario')}\n"
                            ),
                            "topics": ["midsphere", "circuit-breaker"],
                            "related_assets": targets,
                        },
                    )
                ],
                mutations=True,
            )
            for c in calls:
                if c.get("ok"):
                    self.mutations_applied = True
                    self._emit(
                        "MBOMEngine",
                        "TOOL",
                        "save_document official_mcp ok",
                    )
                    self._emit(
                        "MBOMEngine",
                        "MBOM",
                        f"save_document live ok job={self.job_id[:8]}",
                    )
                elif c.get("tool"):
                    self._emit(
                        "MBOMEngine",
                        "STATUS",
                        f"official_mcp save_document fail {str(c.get('error', ''))[:120]}",
                    )
        if not any(
            e.kind == "MBOM" and "live ok" in e.message for e in self.events
        ):
            self._emit(
                "MBOMEngine",
                "MBOM",
                f"mbom artifact path={self.mbom['path']} urn={doc_urn}",
            )
        self._mbom_done = True
        return json.dumps(
            {
                "ok": True,
                "mbom": self.mbom,
                "mutations_applied": self.mutations_applied,
            }
        )

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
