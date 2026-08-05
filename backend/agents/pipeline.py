"""MidSphere closed-loop runner.

Primary workforce: Google Antigravity Agent with custom MidSphere stage tools
(+ optional official DataHub MCP). See agents/antigravity_runner.py.

Fallback: deterministic stages below when Antigravity is disabled or fails.

Telemetry honesty:
- Antigravity path emits TOOL lines for custom tools the agent invoked
- Deterministic fallback uses STATUS lines prefixed with 'sim ' when offline
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
    r"midsphere_\w+|datahub_\w+|create_incident)\b"
)

# Custom tools registered on the Antigravity Agent (not DataHub MCP)
MIDSPHERE_CUSTOM_TOOLS = frozenset(
    {
        "midsphere_context_sentinel_audit",
        "midsphere_cascade_analyzer",
        "midsphere_circuit_breaker_trip",
        "midsphere_fix_architect",
        "midsphere_mbom_engine",
    }
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
    """Allow official MCP tools and MidSphere custom tools; reject invented names."""
    for name in extract_tool_names_from_events(events):
        if name.startswith("datahub_") or name == "create_incident":
            raise AssertionError(f"Forbidden tool name in telemetry: {name}")
        if name in REAL_MCP_TOOLS or name in MIDSPHERE_CUSTOM_TOOLS:
            continue
        if name.startswith("midsphere_"):
            # Forward-compatible custom tool prefix
            continue
        raise AssertionError(f"Unknown/non-MCP tool token in telemetry: {name}")


def run_closed_loop(
    root_urn: str,
    mode: str = "full",
    auto_trip: bool = True,
    client: McpClient | None = None,
) -> JobArtifact:
    """Primary entry: Antigravity workforce first, deterministic fallback second."""
    antigravity_error: BaseException | None = None
    try:
        from agents.antigravity_runner import antigravity_enabled, run_job_with_antigravity

        if antigravity_enabled() and os.environ.get("ANTIGRAVITY_FORCE_FALLBACK", "").lower() not in (
            "1",
            "true",
            "yes",
        ):
            job = run_job_with_antigravity(root_urn, mode=mode, auto_trip=auto_trip)
            assert_telemetry_mcp_clean(job.events)
            return job
    except Exception as exc:  # noqa: BLE001
        antigravity_error = exc
    return run_closed_loop_fallback(
        root_urn,
        mode=mode,
        auto_trip=auto_trip,
        client=client,
        antigravity_error=antigravity_error,
    )


def run_closed_loop_fallback(
    root_urn: str,
    mode: str = "full",
    auto_trip: bool = True,
    client: McpClient | None = None,
    antigravity_error: BaseException | None = None,
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

    if antigravity_error is not None:
        emit(
            "ContextSentinel",
            "ERROR",
            f"antigravity primary failed: {type(antigravity_error).__name__}: {str(antigravity_error)[:240]}",
        )
        emit(
            "ContextSentinel",
            "STATUS",
            "falling back to deterministic closed loop",
        )
    emit(
        "ContextSentinel",
        "STATUS",
        f"stage=ContextSentinel orchestrator=deterministic_fallback gms_reachable={probe.reachable}",
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
    if use_official and probe.reachable:
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

    # Deterministic audit findings based on scenario URN
    if live_tool_calls == 0:
        sim("ContextSentinel", "get_lineage", f"urn={root_urn} max_hops=2 upstream=true")
        sim("ContextSentinel", "list_schema_fields", f"urn={root_urn}")

    urn_lower = root_urn.lower()
    if "ecommerce" in urn_lower or "customers" in urn_lower:
        urn_raw_customers = "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.raw_customers,PROD)"
        urn_stg_customers = "urn:li:dataset:(urn:li:dataPlatform:dbt,ecommerce.stg_customers,PROD)"
        urn_mart_c360 = "urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)"
        urn_mart_catalog = "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.mart_product_catalog,PROD)"

        emit("ContextSentinel", "FIND", f"UNGOVERNED_PII severity=CRITICAL entity={urn_mart_c360}")
        emit("ContextSentinel", "FIND", f"MISSING_OWNER severity=HIGH entity={urn_raw_customers}")

        findings = [
            AuditFinding(
                id="f_pii1",
                type="UNGOVERNED_PII",
                severity="CRITICAL",
                entity_urn=urn_mart_c360,
                column_path="social_security_number",
                evidence="Raw unhashed SSN exposed in customer_360 analytics mart",
                rationale="Unencrypted PII violates GDPR & HIPAA compliance policies",
            ),
            AuditFinding(
                id="f_pii2",
                type="MISSING_OWNER",
                severity="HIGH",
                entity_urn=urn_raw_customers,
                column_path="owner",
                evidence="Dataset ownership metadata is unassigned",
                rationale="Orphan datasets increase compliance risk and response latency",
            ),
        ]
        blast_nodes = [
            BlastNode(urn=urn_raw_customers, name="raw_customers", hop=0, impacted=True, reason="Contains raw unmasked customer PII"),
            BlastNode(urn=urn_stg_customers, name="stg_customers", hop=1, impacted=True, reason="Propagates unmasked SSN to analytics layer"),
            BlastNode(urn=urn_mart_c360, name="mart_customer_360", hop=2, impacted=True, reason="Exposes SSN to business intelligence dashboards"),
            BlastNode(urn=urn_mart_catalog, name="mart_product_catalog", hop=2, impacted=False, reason="No PII fields involved (selective halt)"),
        ]
        risk = 88
        quarantine_urns = [urn_mart_c360]
        quarantine_tags = ["urn:li:tag:PII_LEAK", "urn:li:tag:QUARANTINED", "urn:li:tag:MIDSPHERE_AUDIT"]
        pr_path = "examples/prs/fix-pii-masking.example.diff"
        pr_summary = "Apply SHA-256 hashing to SSN in stg_customers.sql"
        mbom_doc = "urn:li:document:midsphere-ecommerce-mbom"
        mbom_path = "examples/mboms/ecommerce-pii-mbom.example.md"

    elif "nyctaxi" in urn_lower or "trips" in urn_lower or "taxi" in urn_lower:
        urn_raw_trips = "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.raw_yellow_trips,PROD)"
        urn_stg_fare = "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.stg_trip_fare,PROD)"
        urn_mart_revenue = "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)"
        urn_mart_dist = "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_trip_distance_stats,PROD)"

        emit("ContextSentinel", "FIND", f"FRESHNESS_VIOLATION severity=HIGH entity={urn_mart_revenue}")
        emit("ContextSentinel", "FIND", f"SCHEMA_DRIFT severity=MEDIUM entity={urn_raw_trips}")

        findings = [
            AuditFinding(
                id="f_taxi1",
                type="FRESHNESS_VIOLATION",
                severity="HIGH",
                entity_urn=urn_mart_revenue,
                column_path="pickup_datetime",
                evidence="Last ingestion timestamp > 72 hours stale (SLA: 24h)",
                rationale="Stale trip ingestion skews monthly revenue reports",
            ),
            AuditFinding(
                id="f_taxi2",
                type="SCHEMA_DRIFT",
                severity="MEDIUM",
                entity_urn=urn_raw_trips,
                column_path="extra_surcharge",
                evidence="Unannounced column addition extra_surcharge in raw ingestion",
                rationale="Schema drift causes downstream dbt compilation failures",
            ),
        ]
        blast_nodes = [
            BlastNode(urn=urn_raw_trips, name="raw_yellow_trips", hop=0, impacted=True, reason="Source table stale by 72h"),
            BlastNode(urn=urn_stg_fare, name="stg_trip_fare", hop=1, impacted=True, reason="Propagates stale ingestion timestamps"),
            BlastNode(urn=urn_mart_revenue, name="mart_monthly_revenue", hop=2, impacted=True, reason="Breaches SLA for executive financial reporting"),
            BlastNode(urn=urn_mart_dist, name="mart_trip_distance_stats", hop=2, impacted=False, reason="Non-time-critical analytics mart (selective halt)"),
        ]
        risk = 65
        quarantine_urns = [urn_mart_revenue]
        quarantine_tags = ["urn:li:tag:PIPELINE_LAG", "urn:li:tag:QUARANTINED", "urn:li:tag:MIDSPHERE_AUDIT"]
        pr_path = "examples/prs/fix-taxi-freshness.example.diff"
        pr_summary = "Adjust BigQuery partition filter & freshness SLA window"
        mbom_doc = "urn:li:document:midsphere-nyctaxi-mbom"
        mbom_path = "examples/mboms/nyctaxi-revenue-mbom.example.md"

    else:
        emit("ContextSentinel", "FIND", f"NEGATIVE_BILLING severity=HIGH entity={URN_BILLING}")
        emit("ContextSentinel", "FIND", f"DATE_SWAP severity=MEDIUM entity={URN_RAW}")

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
        blast_nodes = [
            BlastNode(urn=URN_RAW, name="raw_patients", hop=0, impacted=True, reason="Source of planted quality issues"),
            BlastNode(urn=URN_STAGING, name="staging_patients", hop=1, impacted=True, reason="Propagates source issues"),
            BlastNode(urn=URN_BILLING, name="mart_billing", hop=2, impacted=True, reason="NEGATIVE_BILLING + DATE_SWAP cascade"),
            BlastNode(urn=URN_DEMOGRAPHICS, name="mart_demographics", hop=2, impacted=False, reason="Not affected by this finding set (selective halt)"),
        ]
        risk = 61
        quarantine_urns = [URN_BILLING]
        quarantine_tags = ["urn:li:tag:QUARANTINED", "urn:li:tag:CIRCUIT_BROKEN", "urn:li:tag:MIDSPHERE_AUDIT"]
        pr_path = "examples/prs/fix-negative-billing.example.diff"
        pr_summary = "filter negative billing + enforce admission<=discharge"
        mbom_doc = f"urn:li:document:midsphere-mbom-{job_id[:8]}"
        mbom_path = "examples/mboms/healthcare-billing-mbom.example.md"


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

    nodes = blast_nodes
    impacted = [n for n in nodes if n.impacted]
    non_impacted = [n for n in nodes if not n.impacted]

    emit(
        "CascadeAnalyzer",
        "SCORE",
        f"risk={risk} selective=true impacted={len(impacted)}",
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
            f"stage=CircuitBreaker advisory_quarantine selective_entity={quarantine_urns[0]}",
        )
        quarantine_targets = quarantine_urns

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
            tagsApplied=quarantine_tags,
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
                f"urn={root_urn}",
            )
        emit("FixArchitect", "PR", f"dry_run path={pr_path}")
        pr = {
            "status": "dry_run",
            "path": pr_path,
            "diff_summary": pr_summary,
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
            emit(
                "MBOMEngine",
                "STATUS",
                f"mbom artifact path {mbom_path} urn={mbom_doc}",
            )
            mbom = {
                "document_urn": mbom_doc,
                "path": mbom_path,
                "related_assets": quarantine_targets,
            }
        else:
            mbom = {
                "document_urn": mbom_doc,
                "path": mbom_path,
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
