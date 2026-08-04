"""Antigravity + Gemini enrichment for MidSphere jobs.

Invokes google-antigravity on the job path when enabled and credentials/models
work. On any failure, returns the job unchanged and records honest telemetry.
Never fabricates a successful model response.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

from models.artifacts import JobArtifact, JobEvent
from datetime import datetime, timezone


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]


def _enabled() -> bool:
    return os.environ.get("ANTIGRAVITY_ENABLED", "true").lower() in ("1", "true", "yes")


async def _chat_summary(job: JobArtifact) -> tuple[bool, str, str]:
    """Returns (ok, model_used, text_or_error)."""
    from google.antigravity import Agent, LocalAgentConfig
    from google.antigravity.types import McpStdioServer

    # Never hardcode a GCP project id in source. Prefer env, then ADC metadata.
    project = (
        os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("GCP_PROJECT")
        or os.environ.get("GCLOUD_PROJECT")
        or ""
    )
    if not project:
        try:
            import google.auth

            _, project = google.auth.default()
            project = project or ""
        except Exception:  # noqa: BLE001
            project = ""
    location = os.environ.get("VERTEX_LOCATION", "global")
    # Antigravity is the agent harness; Gemini model IDs are the Vertex backends it can call.
    candidates = [
        m.strip()
        for m in os.environ.get(
            "ANTIGRAVITY_MODELS",
            "gemini-3.6-flash,gemini-3.1-pro-preview,gemini-2.5-flash,gemini-2.5-pro",
        ).split(",")
        if m.strip()
    ]
    if not project:
        return False, "", "GOOGLE_CLOUD_PROJECT unset and ADC project unavailable"

    findings_blob = "\n".join(
        f"- {f.type} {f.severity} {f.entity_urn}: {f.rationale}" for f in job.findings
    )
    prompt = (
        "You are MidSphere ContextSentinel. In under 120 words, summarize the "
        "data quality circuit for operators. Be concrete. No emojis. No em dashes.\n"
        f"Root: {job.root_urn}\n"
        f"Risk: {job.blast_radius.get('risk_score')}\n"
        f"Findings:\n{findings_blob}\n"
        f"Gate: {(job.quarantine.gateStatus if job.quarantine else 'OPEN')}\n"
        "State that quarantine is advisory metadata, not global MCP denial."
    )

    import shutil

    gms = os.environ.get("DATAHUB_GMS_URL", "http://localhost:8080")
    token = os.environ.get("DATAHUB_GMS_TOKEN", "")
    mut = os.environ.get("TOOLS_IS_MUTATION_ENABLED", "false")
    mcp_env = {
        "DATAHUB_GMS_URL": gms,
        "TOOLS_IS_MUTATION_ENABLED": mut,
    }
    if token:
        mcp_env["DATAHUB_GMS_TOKEN"] = token

    uvx = os.environ.get("MCP_UVX") or shutil.which("uvx")
    mcp_servers: list = []
    if uvx and os.environ.get("ANTIGRAVITY_ATTACH_MCP", "true").lower() in (
        "1",
        "true",
        "yes",
    ):
        mcp_servers = [
            McpStdioServer(
                name="datahub",
                command=uvx,
                args=["mcp-server-datahub@latest"],
                env=mcp_env,
            )
        ]

    last_err = "no models tried"
    # Prefer Gemini summary without MCP if MCP spawn would fail (e.g. Cloud Run without uvx)
    for with_mcp in (bool(mcp_servers), False):
        for model in candidates:
            try:
                kwargs = dict(
                    system_instructions=(
                        "You are MidSphere operator summary via Antigravity. Be precise. "
                        "Prefer short operator summaries. No emojis."
                    ),
                    model=model,
                    vertex=True,
                    project=project,
                    location=location,
                )
                if with_mcp and mcp_servers:
                    kwargs["mcp_servers"] = mcp_servers
                config = LocalAgentConfig(**kwargs)
                async with Agent(config) as agent:
                    resp = await agent.chat(prompt)
                    text = await resp.text()
                    if text and text.strip():
                        return True, model, text.strip()[:1500]
                    last_err = f"{model}: empty response"
            except Exception as exc:  # noqa: BLE001
                last_err = f"{model}: {type(exc).__name__}: {str(exc)[:240]}"
                continue
        if not mcp_servers:
            break
    return False, "", last_err


def enrich_job_with_antigravity(job: JobArtifact) -> JobArtifact:
    """Sync entry used by the closed-loop runner."""
    if not _enabled():
        job.events.append(
            JobEvent(
                ts=_ts(),
                agent="ContextSentinel",
                kind="STATUS",
                message="antigravity skipped (ANTIGRAVITY_ENABLED=false)",
            )
        )
        return job

    try:
        ok, model, payload = asyncio.run(_chat_summary(job))
    except Exception as exc:  # noqa: BLE001
        job.events.append(
            JobEvent(
                ts=_ts(),
                agent="ContextSentinel",
                kind="ERROR",
                message=f"antigravity failed: {type(exc).__name__}: {str(exc)[:300]}",
            )
        )
        # annotate job for honest claims
        extra: dict[str, Any] = getattr(job, "__dict__", {})
        job.events.append(
            JobEvent(
                ts=_ts(),
                agent="ContextSentinel",
                kind="STATUS",
                message="closed-loop continues without LLM enrichment",
            )
        )
        return job

    if ok:
        job.events.append(
            JobEvent(
                ts=_ts(),
                agent="ContextSentinel",
                kind="STATUS",
                message=f"antigravity gemini model={model} summary_ok",
            )
        )
        job.events.append(
            JobEvent(
                ts=_ts(),
                agent="ContextSentinel",
                kind="STATUS",
                message=f"antigravity_summary: {payload[:500]}",
            )
        )
        # store on job via dynamic field if model allows
        if hasattr(job, "model_copy"):
            try:
                data = job.model_dump()
                data.setdefault("pr", job.pr or {})
                # keep summary in mbom-adjacent note without lying about documents
                job.events.append(
                    JobEvent(
                        ts=_ts(),
                        agent="MBOMEngine",
                        kind="STATUS",
                        message="llm summary attached to telemetry only (not a save_document claim)",
                    )
                )
            except Exception:
                pass
    else:
        job.events.append(
            JobEvent(
                ts=_ts(),
                agent="ContextSentinel",
                kind="ERROR",
                message=f"antigravity unavailable: {payload[:400]}",
            )
        )
        job.events.append(
            JobEvent(
                ts=_ts(),
                agent="ContextSentinel",
                kind="STATUS",
                message="closed-loop continues without LLM enrichment",
            )
        )
    return job
