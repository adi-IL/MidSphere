"""Antigravity as MidSphere primary workforce.

Uses google-antigravity Agent + LocalAgentConfig with:
- custom MidSphere stage tools (audit, cascade, break, fix, mbom)
- optional official DataHub MCP server (stdio)
- Gemini model IDs on Vertex via ADC

On failure, callers fall back to deterministic run_closed_loop_fallback.
"""

from __future__ import annotations

import asyncio
import os
import shutil
from datetime import datetime, timezone

from agents.stage_tools import MidSphereJobBuilder
from models.artifacts import JobArtifact, JobEvent


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]


def antigravity_enabled() -> bool:
    return os.environ.get("ANTIGRAVITY_ENABLED", "true").lower() in ("1", "true", "yes")


def _resolve_project() -> str:
    project = (
        os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("GCP_PROJECT")
        or os.environ.get("GCLOUD_PROJECT")
        or ""
    )
    if project:
        return project
    try:
        import google.auth

        _, project = google.auth.default()
        return project or ""
    except Exception:  # noqa: BLE001
        return ""


def _model_candidates() -> list[str]:
    return [
        m.strip()
        for m in os.environ.get(
            "ANTIGRAVITY_MODELS",
            "gemini-3.6-flash,gemini-3.1-pro-preview,gemini-2.5-flash,gemini-2.5-pro",
        ).split(",")
        if m.strip()
    ]


SYSTEM = """You are MidSphere, an autonomous context circuit-breaker for DataHub.
You run a closed-loop quality quarantine workflow by calling MidSphere tools IN ORDER:

1. midsphere_context_sentinel_audit(root_urn)  - always first
2. midsphere_cascade_analyzer(max_hops=2)      - after audit
3. midsphere_circuit_breaker_trip(auto_trip=true) - after cascade (unless dry_run)
4. midsphere_fix_architect()                  - after trip
5. midsphere_mbom_engine()                     - last stage

Rules:
- You MUST call these custom tools. Do not invent findings without calling tools.
- Quarantine is advisory metadata, not global MCP auto-denial.
- Be selective: billing issues should not quarantine demographics-only paths.
- After tools finish, write a short operator summary (under 120 words). No emojis.
- Prefer DataHub MCP tools only when useful for extra catalog context.
"""


async def _run_agent_loop(
    root_urn: str,
    mode: str,
    auto_trip: bool,
) -> JobArtifact:
    from google.antigravity import Agent, LocalAgentConfig
    from google.antigravity.types import McpStdioServer

    project = _resolve_project()
    if not project:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT unset and ADC project unavailable")

    location = os.environ.get("VERTEX_LOCATION") or os.environ.get(
        "GOOGLE_CLOUD_LOCATION", "global"
    )
    builder = MidSphereJobBuilder(root_urn=root_urn, mode=mode, auto_trip=auto_trip)
    tools = builder.tool_list()

    gms = os.environ.get("DATAHUB_GMS_URL", "http://localhost:8080")
    token = os.environ.get("DATAHUB_GMS_TOKEN", "")
    mut = os.environ.get("TOOLS_IS_MUTATION_ENABLED", "false")
    mcp_env = {"DATAHUB_GMS_URL": gms, "TOOLS_IS_MUTATION_ENABLED": mut}
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

    prompt = (
        f"Run the full MidSphere closed loop now.\n"
        f"root_urn={root_urn}\n"
        f"mode={mode}\n"
        f"auto_trip={auto_trip}\n"
        f"Call the five midsphere_* tools in order, then summarize."
    )

    last_err = "no models tried"
    for with_mcp in (bool(mcp_servers), False):
        for model in _model_candidates():
            try:
                kwargs: dict = {
                    "system_instructions": SYSTEM,
                    "model": model,
                    "vertex": True,
                    "project": project,
                    "location": location,
                    "tools": tools,
                }
                if with_mcp and mcp_servers:
                    kwargs["mcp_servers"] = mcp_servers
                config = LocalAgentConfig(**kwargs)
                builder.events.append(
                    JobEvent(
                        ts=_ts(),
                        agent="ContextSentinel",
                        kind="STATUS",
                        message=f"antigravity primary workforce start model={model} mcp={with_mcp}",
                    )
                )
                async with Agent(config) as agent:
                    response = await agent.chat(prompt)
                    # Stream tool call events into telemetry when available
                    try:
                        async for call in response.tool_calls:
                            name = getattr(call, "name", None) or str(call)
                            builder.events.append(
                                JobEvent(
                                    ts=_ts(),
                                    agent="ContextSentinel",
                                    kind="TOOL",
                                    message=f"antigravity tool_call {name}",
                                )
                            )
                    except Exception:  # noqa: BLE001
                        pass
                    text = await response.text()
                    if text and text.strip():
                        builder.operator_summary = text.strip()[:1500]
                        builder.events.append(
                            JobEvent(
                                ts=_ts(),
                                agent="ContextSentinel",
                                kind="STATUS",
                                message=f"antigravity gemini model={model} workforce_ok",
                            )
                        )
                        builder.events.append(
                            JobEvent(
                                ts=_ts(),
                                agent="ContextSentinel",
                                kind="STATUS",
                                message=f"antigravity_summary: {builder.operator_summary[:500]}",
                            )
                        )
                    job = builder.to_job(
                        execution_mode="antigravity_closed_loop",
                        datahub_reachable=False,
                    )
                    # Ensure at least one stage TOOL event if agent skipped calls
                    # (ensure_complete_fallback inside to_job already ran stages)
                    return job
            except Exception as exc:  # noqa: BLE001
                last_err = f"{model}: {type(exc).__name__}: {str(exc)[:280]}"
                # reset builder for next attempt
                builder = MidSphereJobBuilder(
                    root_urn=root_urn, mode=mode, auto_trip=auto_trip
                )
                tools = builder.tool_list()
                continue
        if not mcp_servers:
            break
    raise RuntimeError(last_err)


def run_job_with_antigravity(
    root_urn: str,
    mode: str = "full",
    auto_trip: bool = True,
) -> JobArtifact:
    """Primary workforce entry. Raises if Antigravity cannot complete."""
    if not antigravity_enabled():
        raise RuntimeError("ANTIGRAVITY_ENABLED=false")
    return asyncio.run(_run_agent_loop(root_urn, mode, auto_trip))


def enrich_job_with_antigravity(job: JobArtifact) -> JobArtifact:
    """Legacy summary-only path kept for compatibility; prefer run_job_with_antigravity."""
    if not antigravity_enabled():
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
        # If job already ran via primary path, skip double work
        if any("workforce_ok" in e.message for e in job.events):
            return job
        primary = run_job_with_antigravity(job.root_urn, job.mode, True)
        return primary
    except Exception as exc:  # noqa: BLE001
        job.events.append(
            JobEvent(
                ts=_ts(),
                agent="ContextSentinel",
                kind="ERROR",
                message=f"antigravity unavailable: {type(exc).__name__}: {str(exc)[:300]}",
            )
        )
        return job
