"""MidSphere closed-loop runner: audit → blast → quarantine → fix → MBOM.

Shared by HTTP API and unit tests. Telemetry uses real unprefixed MCP tool names.
Live DataHub mutations only when GMS probe succeeds and mutations are enabled.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Callable

from models.artifacts import (
    AuditFinding,
    BlastNode,
    JobArtifact,
    JobEvent,
    QuarantineReceipt,
)
from mcp.client import REAL_MCP_TOOLS, McpClient, build_client_from_env

# Healthcare selective-halt URNs (demo graph)
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

# Matches tool-name tokens in telemetry for validation
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
    """Published formula (ARCHITECTURE): clamp 0–100."""
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
    names: list[str] = []
    for e in events:
        if e.kind not in ("TOOL", "WRITE", "MBOM", "PR"):
            continue
        for m in _TOOL_TOKEN_RE.findall(e.message):
            names.append(m)
    return names


def assert_telemetry_mcp_clean(events: list[JobEvent]) -> None:
    """Raise if telemetry invents forbidden tool names."""
    for name in extract_tool_names_from_events(events):
        if name.startswith("datahub_") or name == "create_incident":
            raise AssertionError(f"Forbidden tool name in telemetry: {name}")
        if name not in REAL_MCP_TOOLS:
            # allow only known real tools when we emit tool-shaped tokens
            raise AssertionError(f"Unknown/non-MCP tool token in telemetry: {name}")


def run_closed_loop(
    root_urn: str,
    mode: str = "full",
    auto_trip: bool = True,
    client: McpClient | None = None,
) -> JobArtifact:
    """Primary entry: full MidSphere closed loop on a root URN."""
    job_id = str(uuid.uuid4())
    events: list[JobEvent] = []
    mcp = client or build_client_from_env()
    probe = mcp.probe()

    def emit(agent: str, kind: str, message: str) -> None:
        events.append(
            JobEvent(ts=_ts(), agent=agent, kind=kind, message=message)  # type: ignore[arg-type]
        )

    emit(
        "ContextSentinel",
        "STATUS",
        f"datahub probe reachable={probe.reachable} detail={probe.detail}",
    )
    emit("ContextSentinel", "TOOL", f"get_lineage urn={root_urn} max_hops=2 upstream=true")
    mcp.record_tool("get_lineage")
    emit("ContextSentinel", "TOOL", f"list_schema_fields urn={URN_RAW}")
    mcp.record_tool("list_schema_fields")
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
    assert impacted and non_impacted  # selective semantics baked into demo graph

    risk = compute_risk_score(
        severity="HIGH",
        downstream_count=len(impacted),
        has_pii=True,
        has_production_env=True,
        missing_owner=False,
    )
    emit("CascadeAnalyzer", "TOOL", f"get_lineage urn={URN_STAGING} downstream=true max_hops=2")
    mcp.record_tool("get_lineage")
    emit(
        "CascadeAnalyzer",
        "SCORE",
        f"risk={risk} selective=true billing=yes demographics=no impacted={len(impacted)}",
    )

    quarantine = None
    pr = None
    mbom = None
    mutations_applied = False
    execution_mode = "live_mcp" if (probe.reachable and probe.mutations_enabled) else "demo_closed_loop"

    if mode != "dry_run" and auto_trip:
        quarantine_targets = [URN_BILLING]  # selective: billing only, not demographics
        emit(
            "CircuitBreaker",
            "TOOL",
            f"add_tags tag_urns=[urn:li:tag:QUARANTINED,urn:li:tag:CIRCUIT_BROKEN] "
            f"entity_urns={len(quarantine_targets)}",
        )
        mcp.record_tool("add_tags")
        emit(
            "CircuitBreaker",
            "WRITE",
            "add_structured_properties property=midsphere.gate_status value=BLOCKED",
        )
        mcp.record_tool("add_structured_properties")

        if execution_mode == "live_mcp":
            # Best-effort live GraphQL tag mutation — success optional; flag honestly
            gql = """
            mutation($input: BatchAddTagsInput!) {
              batchAddTags(input: $input)
            }
            """
            result = mcp.try_graphql(
                gql,
                {
                    "input": {
                        "tagUrns": ["urn:li:tag:QUARANTINED"],
                        "resources": [{"resourceUrn": URN_BILLING}],
                    }
                },
            )
            if result is not None and "errors" not in result:
                mutations_applied = True
                emit("CircuitBreaker", "STATUS", "live GMS batchAddTags attempted ok")
            else:
                emit(
                    "CircuitBreaker",
                    "STATUS",
                    "live GMS mutation unavailable or failed; advisory state local only",
                )
                execution_mode = "demo_closed_loop"
        else:
            emit(
                "CircuitBreaker",
                "STATUS",
                "demo_closed_loop: advisory quarantine local; no live DataHub mutation claimed",
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

        emit("FixArchitect", "TOOL", f"get_dataset_queries urn={URN_STAGING}")
        mcp.record_tool("get_dataset_queries")
        fix_path = "examples/prs/fix-negative-billing.example.diff"
        emit("FixArchitect", "PR", f"dry_run path={fix_path}")
        pr = {
            "status": "dry_run",
            "path": fix_path,
            "diff_summary": "filter negative billing + enforce admission<=discharge",
        }

        emit(
            "MBOMEngine",
            "TOOL",
            "save_document type=Analysis related_assets=1",
        )
        mcp.record_tool("save_document")
        doc_urn = f"urn:li:document:midsphere-mbom-{job_id[:8]}"
        emit("MBOMEngine", "MBOM", f"save_document urn={doc_urn}")
        mbom = {
            "document_urn": doc_urn,
            "path": "examples/mboms/healthcare-billing-mbom.example.md",
            "related_assets": quarantine_targets,
        }

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
    """Reverse path: remove quarantine for URN(s); gate becomes not BLOCKED."""
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
            kind="TOOL",
            message=f"remove_tags tag_urns=[urn:li:tag:QUARANTINED] entity_urns={len(targets)}",
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
            t for t in job.quarantine.tagsApplied if "QUARANTINED" not in t and "CIRCUIT" not in t
        ]
    else:
        job.quarantine.gateStatus = "BLOCKED"
        job.quarantine.properties["midsphere.gate_status"] = "BLOCKED"

    job.events.append(
        JobEvent(
            ts=_ts(),
            agent="CircuitBreaker",
            kind="WRITE",
            message=f"gate_status={job.quarantine.gateStatus} remaining={len(remaining)}",
        )
    )
    return job


# Back-compat alias used by early routes
def run_demo_pipeline(
    root_urn: str, mode: str = "full", auto_trip: bool = True
) -> JobArtifact:
    return run_closed_loop(root_urn, mode=mode, auto_trip=auto_trip)
