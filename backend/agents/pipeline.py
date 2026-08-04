"""MidSphere closed-loop runner: audit → blast → quarantine → fix → MBOM.

Deterministic orchestrator stages (Sentinel → Cascade → Breaker → Fix → MBOM).
Optional: official mcp-server-datahub tool calls when USE_OFFICIAL_MCP=true and GMS is up.
Optional: one Antigravity/Gemini operator summary after the loop.

Telemetry honesty:
- kind TOOL / WRITE only after a real MCP (or GMS) attempt
- kind STATUS with prefix 'sim ' for deterministic demo steps that did not call MCP
"""

from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone

from models.artifacts import (
    AuditFinding,
    BlastNode,
    JobArtifact,
    JobEvent,
    QuarantineReceipt,
)
from midsphere_mcp.client import REAL_MCP_TOOLS, McpClient, build_client_from_env

URN_RAW = "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)"
URN_STAGING = (
    "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.staging_patients,PROD)"
)
URN_BILLING = (
    "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)"
)
URN_DEMOGRAPHICS = (
    "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_demographics,PROD)"
)

SEVERITY_WEIGHT = {"CRITICAL": 1.0, "HIGH": 0.75, "MEDIUM": 0.5, "LOW": 0.25}

_TOOL_TOKEN_RE = re.compile(
    r"\b(get_lineage|list_schema_fields|get_entities|search|get_dataset_queries|"
    r"add_tags|remove_tags|add_structured_properties|remove_structured_properties|"
    r"save_document|update_description|get_lineage_paths_between|search_documents|"
    r"datahub_\w+|create_incident)\b"
)


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]


def compute_risk_score(
    *,
    severity: str,
    downstream_count: int,
    has_pii: bool = True,
    has_production_env: bool = True,
    missing_owner: bool = False,
) -> int:
    sw = SEVERITY_WEIGHT.get(severity, 0.5)
    raw = (
        25 * sw
        + 25 * min(1.0, downstream_count / 10)
        + 20 * (1 if has_pii else 0)
        + 15 * (1 if has_production_env else 0)
        + 15 * (1 if missing_owner else 0)
    )
    return int(max(0, min(100, round(raw))))


def extract_tool_names_from_events(events: list[JobEvent]) -> list[str]:
    """Only extract tool names from real TOOL/WRITE/MBOM lines (not sim STATUS)."""
    names: list[str] = []
    for e in events:
        if e.kind not in ("TOOL", "WRITE", "MBOM"):
            continue
        if e.message.startswith("sim "):
            continue
        for m in _TOOL_TOKEN_RE.findall(e.message):
            names.append(m)
    return names


def assert_telemetry_mcp_clean(events: list[JobEvent]) -> None:
    for name in extract_tool_names_from_events(events):
        if name.startswith("datahub_") or name == "create_incident":
            raise AssertionError(f"Forbidden tool name in telemetry: {name}")
        if name not in REAL_MCP_TOOLS:
            raise AssertionError(f"Unknown/non-MCP tool token in telemetry: {name}")


def run_closed_loop(
    root_urn: str,
    mode: str = "full",
    auto_trip: bool = True,
    client: McpClient | None = None,
) -> JobArtifact:
    job_id = str(uuid.uuid4())
    events: list[JobEvent] = []
    mcp = client or build_client_from_env()
    probe = mcp.probe()
    live_tool_calls = 0

    def emit(agent: str, kind: str, message: str) -> None:
        events.append(
            JobEvent(ts=_ts(), agent=agent, kind=kind, message=message)  # type: ignore[arg-type]
        )

    def sim(agent: str, tool: str, detail: str) -> None:
        """Deterministic demo step — not a live MCP call."""
        emit(
            agent,
            "STATUS",
            f"sim {tool} {detail} (demo_closed_loop; no live MCP call)",
        )
        mcp.record_tool(tool)

    emit(
        "ContextSentinel",
        "STATUS",
        f"stage=ContextSentinel orchestrator=deterministic gms_reachable={probe.reachable}",
    )
    emit(
        "ContextSentinel",
        "STATUS",
        f"datahub probe reachable={probe.reachable} detail={probe.detail}",
    )

    # Prefer live official MCP reads when enabled and tools available
    official_ok = False
    official_tools: list[str] = []
    use_official = os.environ.get("USE_OFFICIAL_MCP", "true").lower() in (
        "1",
        "true",
        "yes",
    )
    if use_official:
        try:
            from midsphere_mcp.official import call_official_mcp, probe_official_mcp

            s_url = os.environ.get("DATAHUB_GMS_URL", "http://localhost:8080")
            s_tok = os.environ.get("DATAHUB_GMS_TOKEN", "")
            mut = os.environ.get("TOOLS_IS_MUTATION_ENABLED", "false").lower() in (
                "1",
                "true",
                "yes",
            )
            official = probe_official_mcp(s_url, s_tok, mutations=mut)
            if official.ok and official.tools:
                official_ok = True
                official_tools = official.tools
                emit(
                    "ContextSentinel",
                    "STATUS",
                    f"official mcp-server-datahub up tools={len(official.tools)} cmd={official.server_cmd}",
                )
                # Real tool invocations only when GMS is reachable
                if probe.reachable:
                    read_calls: list[tuple[str, dict]] = []
                    if "get_lineage" in official_tools:
                        read_calls.append(
                            (
                                "get_lineage",
                                {
                                    "urn": root_urn,
                                    "upstream": True,
                                    "max_hops": 2,
                                },
                            )
                        )
                    if "list_schema_fields" in official_tools:
                        read_calls.append(
                            ("list_schema_fields", {"urn": URN_RAW})
                        )
                    if "search" in official_tools:
                        read_calls.append(("search", {"query": "healthcare"}))
                    if read_calls:
                        live = call_official_mcp(
                            s_url,
                            s_tok,
                            mutations=False,
                            tool_calls=read_calls,
                            timeout=90.0,
                        )
                        for c in live.calls:
                            if c.get("ok"):
                                live_tool_calls += 1
                                emit(
                                    "ContextSentinel",
                                    "TOOL",
                                    f"{c.get('tool')} official_mcp ok",
                                )
                            else:
                                emit(
                                    "ContextSentinel",
                                    "STATUS",
                                    f"official_mcp {c.get('tool')} fail {c.get('error', '')[:120]}",
                                )
                else:
                    emit(
                        "ContextSentinel",
                        "STATUS",
                        "official mcp client ready but GMS unreachable; skipping live tool calls",
                    )
            else:
                emit(
                    "ContextSentinel",
                    "STATUS",
                    f"official mcp unavailable: {(official.error or 'no tools')[:280]}",
                )
        except Exception as exc:  # noqa: BLE001
            emit(
                "ContextSentinel",
                "ERROR",
                f"official mcp path error: {type(exc).__name__}: {str(exc)[:240]}",
            )
    else:
        emit(
            "ContextSentinel",
            "STATUS",
            "USE_OFFICIAL_MCP=false; deterministic stages only (no official MCP process)",
        )

    # Deterministic audit findings (demo healthcare graph)
    if live_tool_calls == 0:
        sim("ContextSentinel", "get_lineage", f"urn={root_urn} max_hops=2 upstream=true")
        sim("ContextSentinel", "list_schema_fields", f"urn={URN_RAW}")

    emit(
        "ContextSentinel",
        "FIND",
        f"NEGATIVE_BILLING severity=HIGH entity={URN_BILLING}",
    )
    emit(
        "ContextSentinel",
        "FIND",
        f"DATE_SWAP severity=MEDIUM entity={URN_RAW}",
    )

    findings = [
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

    emit(
        "CascadeAnalyzer",
        "STATUS",
        "stage=CascadeAnalyzer orchestrator=deterministic selective_halt=true",
    )
    if live_tool_calls == 0:
        sim(
            "CascadeAnalyzer",
            "get_lineage",
            f"urn={URN_STAGING} downstream=true max_hops=2",
        )

    nodes = [
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
    impacted = [n for n in nodes if n.impacted]
    non_impacted = [n for n in nodes if not n.impacted]
    assert impacted and non_impacted

    risk = compute_risk_score(
        severity="HIGH",
        downstream_count=len(impacted),
        has_pii=True,
        has_production_env=True,
        missing_owner=False,
    )
    emit(
        "CascadeAnalyzer",
        "SCORE",
        f"risk={risk} selective=true billing=yes demographics=no impacted={len(impacted)}",
    )

    quarantine = None
    pr = None
    mbom = None
    mutations_applied = False
    execution_mode = (
        "live_mcp" if (probe.reachable and live_tool_calls > 0) else "demo_closed_loop"
    )

    if mode != "dry_run" and auto_trip:
        emit(
            "CircuitBreaker",
            "STATUS",
            "stage=CircuitBreaker advisory_quarantine selective_entity=mart_billing",
        )
        quarantine_targets = [URN_BILLING]
        # Real mutations only when official MCP + mutations + GMS
        mut_env = os.environ.get("TOOLS_IS_MUTATION_ENABLED", "false").lower() in (
            "1",
            "true",
            "yes",
        )
        wrote_live = False
        if (
            use_official
            and official_ok
            and probe.reachable
            and mut_env
            and "add_tags" in official_tools
        ):
            try:
                from midsphere_mcp.official import call_official_mcp

                s_url = os.environ.get("DATAHUB_GMS_URL", "http://localhost:8080")
                s_tok = os.environ.get("DATAHUB_GMS_TOKEN", "")
                live = call_official_mcp(
                    s_url,
                    s_tok,
                    mutations=True,
                    tool_calls=[
                        (
                            "add_tags",
                            {
                                "tag_urns": [
                                    "urn:li:tag:QUARANTINED",
                                    "urn:li:tag:CIRCUIT_BROKEN",
                                ],
                                "entity_urns": quarantine_targets,
                            },
                        )
                    ],
                    timeout=90.0,
                )
                for c in live.calls:
                    if c.get("ok"):
                        wrote_live = True
                        mutations_applied = True
                        live_tool_calls += 1
                        emit("CircuitBreaker", "TOOL", f"{c.get('tool')} official_mcp ok")
                        emit(
                            "CircuitBreaker",
                            "WRITE",
                            "add_tags applied via official mcp-server-datahub",
                        )
                    else:
                        emit(
                            "CircuitBreaker",
                            "STATUS",
                            f"official_mcp add_tags fail {c.get('error', '')[:120]}",
                        )
            except Exception as exc:  # noqa: BLE001
                emit(
                    "CircuitBreaker",
                    "ERROR",
                    f"live mutation error: {type(exc).__name__}: {str(exc)[:200]}",
                )

        if not wrote_live:
            sim(
                "CircuitBreaker",
                "add_tags",
                "tag_urns=[QUARANTINED,CIRCUIT_BROKEN] entity_urns=1",
            )
            sim(
                "CircuitBreaker",
                "add_structured_properties",
                "property=midsphere.gate_status value=BLOCKED",
            )
            emit(
                "CircuitBreaker",
                "STATUS",
                "advisory quarantine recorded in job artifact only (no live DataHub write)",
            )

        quarantine = QuarantineReceipt(
            entityUrns=quarantine_targets,
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

        emit(
            "FixArchitect",
            "STATUS",
            "stage=FixArchitect metadata_aware_diff dry_run",
        )
        if live_tool_calls == 0 or "get_dataset_queries" not in official_tools:
            sim(
                "FixArchitect",
                "get_dataset_queries",
                f"urn={URN_STAGING}",
            )
        fix_path = "examples/prs/fix-negative-billing.example.diff"
        emit("FixArchitect", "PR", f"dry_run path={fix_path}")
        pr = {
            "status": "dry_run",
            "path": fix_path,
            "diff_summary": "filter negative billing + enforce admission<=discharge",
        }

        emit("MBOMEngine", "STATUS", "stage=MBOMEngine attestation")
        if (
            use_official
            and official_ok
            and probe.reachable
            and mut_env
            and "save_document" in official_tools
        ):
            # live save_document attempted only with mutations
            try:
                from midsphere_mcp.official import call_official_mcp

                s_url = os.environ.get("DATAHUB_GMS_URL", "http://localhost:8080")
                s_tok = os.environ.get("DATAHUB_GMS_TOKEN", "")
                doc_title = f"MBOM MidSphere {job_id[:8]}"
                live = call_official_mcp(
                    s_url,
                    s_tok,
                    mutations=True,
                    tool_calls=[
                        (
                            "save_document",
                            {
                                "document_type": "Analysis",
                                "title": doc_title,
                                "content": f"# MBOM\njob={job_id}\nrisk={risk}\n",
                                "topics": ["midsphere", "circuit-breaker"],
                                "related_assets": quarantine_targets,
                            },
                        )
                    ],
                    timeout=90.0,
                )
                for c in live.calls:
                    if c.get("ok"):
                        live_tool_calls += 1
                        mutations_applied = True
                        emit("MBOMEngine", "TOOL", "save_document official_mcp ok")
                        emit("MBOMEngine", "MBOM", f"save_document live ok job={job_id[:8]}")
                    else:
                        emit(
                            "MBOMEngine",
                            "STATUS",
                            f"official_mcp save_document fail {c.get('error', '')[:120]}",
                        )
            except Exception as exc:  # noqa: BLE001
                emit(
                    "MBOMEngine",
                    "ERROR",
                    f"save_document error: {type(exc).__name__}: {str(exc)[:200]}",
                )

        if not any(
            e.kind == "MBOM" and "live ok" in e.message for e in events
        ):
            sim("MBOMEngine", "save_document", "type=Analysis related_assets=1")
            doc_urn = f"urn:li:document:midsphere-mbom-{job_id[:8]}"
            emit(
                "MBOMEngine",
                "STATUS",
                f"mbom artifact path examples/mboms/healthcare-billing-mbom.example.md urn={doc_urn}",
            )
            mbom = {
                "document_urn": doc_urn,
                "path": "examples/mboms/healthcare-billing-mbom.example.md",
                "related_assets": quarantine_targets,
            }
        else:
            mbom = {
                "document_urn": f"urn:li:document:midsphere-mbom-{job_id[:8]}",
                "path": "examples/mboms/healthcare-billing-mbom.example.md",
                "related_assets": quarantine_targets,
            }

    if execution_mode == "demo_closed_loop":
        emit(
            "ContextSentinel",
            "STATUS",
            f"execution_mode=demo_closed_loop live_tool_calls={live_tool_calls} mutations_applied={mutations_applied}",
        )

    job = JobArtifact(
        job_id=job_id,
        root_urn=root_urn,
        mode=mode,
        status="succeeded",
        findings=findings,
        blast_radius={
            "risk_score": risk,
            "nodes": [n.model_dump() for n in nodes],
            "selective": True,
        },
        quarantine=quarantine,
        pr=pr,
        mbom=mbom,
        events=events,
        execution_mode=execution_mode,  # type: ignore[arg-type]
        mutations_applied=mutations_applied,
        datahub_reachable=probe.reachable,
    )

    assert_telemetry_mcp_clean(job.events)

    try:
        from agents.antigravity_runner import enrich_job_with_antigravity

        job = enrich_job_with_antigravity(job)
    except Exception as exc:  # noqa: BLE001
        job.events.append(
            JobEvent(
                ts=_ts(),
                agent="ContextSentinel",
                kind="ERROR",
                message=f"antigravity import/run error: {type(exc).__name__}: {str(exc)[:200]}",
            )
        )

    return job


def lift_quarantine(
    job: JobArtifact,
    entity_urns: list[str] | None = None,
    client: McpClient | None = None,
) -> JobArtifact:
    if job.quarantine is None:
        job.events.append(
            JobEvent(
                ts=_ts(),
                agent="CircuitBreaker",
                kind="STATUS",
                message="lift skipped: no quarantine receipt",
            )
        )
        return job

    targets = set(entity_urns or list(job.quarantine.entityUrns))
    remaining = [u for u in job.quarantine.entityUrns if u not in targets]
    job.events.append(
        JobEvent(
            ts=_ts(),
            agent="CircuitBreaker",
            kind="STATUS",
            message=f"sim remove_tags entity_urns={len(targets)} (job-local lift; no live MCP unless configured)",
        )
    )
    mcp = client or build_client_from_env()
    try:
        mcp.record_tool("remove_tags")
    except Exception:  # noqa: BLE001
        pass

    job.quarantine.entityUrns = remaining
    if not remaining:
        job.quarantine.gateStatus = "LIFTED"
        job.quarantine.properties["midsphere.gate_status"] = "LIFTED"
        job.quarantine.tagsApplied = [
            t
            for t in job.quarantine.tagsApplied
            if "QUARANTINED" not in t and "CIRCUIT" not in t
        ]
    else:
        job.quarantine.gateStatus = "BLOCKED"
        job.quarantine.properties["midsphere.gate_status"] = "BLOCKED"

    job.events.append(
        JobEvent(
            ts=_ts(),
            agent="CircuitBreaker",
            kind="STATUS",
            message=f"gate_status={job.quarantine.gateStatus} remaining={len(remaining)}",
        )
    )
    return job


def run_demo_pipeline(
    root_urn: str, mode: str = "full", auto_trip: bool = True
) -> JobArtifact:
    return run_closed_loop(root_urn, mode=mode, auto_trip=auto_trip)
