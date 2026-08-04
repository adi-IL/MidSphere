"""Official DataHub MCP Server client (mcp-server-datahub via stdio).

Launches `uvx mcp-server-datahub@latest` (or MCP_SERVER_CMD override) and calls
tools by their real unprefixed names. Never invents datahub_* tool names.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
from dataclasses import dataclass, field
from typing import Any

from mcp import ClientSession, StdioServerParameters  # PyPI package: mcp
from mcp.client.stdio import stdio_client

REAL_MCP_TOOLS = frozenset(
    {
        "search",
        "get_entities",
        "list_schema_fields",
        "get_lineage",
        "get_lineage_paths_between",
        "get_dataset_queries",
        "search_documents",
        "grep_documents",
        "add_tags",
        "remove_tags",
        "add_structured_properties",
        "remove_structured_properties",
        "save_document",
        "update_description",
        "add_terms",
        "remove_terms",
        "add_owners",
        "remove_owners",
        "set_domains",
        "remove_domains",
        "get_me",
    }
)


@dataclass
class OfficialMcpResult:
    ok: bool
    tools: list[str] = field(default_factory=list)
    calls: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None
    server_cmd: str = ""
    mutations_enabled: bool = False


def _server_env(gms_url: str, token: str, mutations: bool) -> dict[str, str]:
    env = os.environ.copy()
    env["DATAHUB_GMS_URL"] = gms_url
    if token:
        env["DATAHUB_GMS_TOKEN"] = token
    env["TOOLS_IS_MUTATION_ENABLED"] = "true" if mutations else "false"
    env["SAVE_DOCUMENT_TOOL_ENABLED"] = "true"
    return env


def _resolve_command() -> tuple[str, list[str]]:
    """Prefer uvx mcp-server-datahub@latest; allow override via MCP_SERVER_CMD."""
    override = os.environ.get("MCP_SERVER_CMD", "").strip()
    if override:
        parts = override.split()
        return parts[0], parts[1:]
    uvx = shutil.which("uvx")
    if uvx:
        return uvx, ["mcp-server-datahub@latest"]
    # fallback: python -m if installed
    return "uvx", ["mcp-server-datahub@latest"]


async def _run_session(
    gms_url: str,
    token: str,
    mutations: bool,
    tool_calls: list[tuple[str, dict[str, Any]]],
    timeout: float = 45.0,
) -> OfficialMcpResult:
    cmd, args = _resolve_command()
    if not shutil.which(cmd) and cmd == "uvx":
        return OfficialMcpResult(
            ok=False,
            error="uvx not found; install uv to run official mcp-server-datahub",
            server_cmd=f"{cmd} {' '.join(args)}",
        )

    params = StdioServerParameters(
        command=cmd,
        args=args,
        env=_server_env(gms_url, token, mutations),
    )
    result = OfficialMcpResult(
        ok=False,
        server_cmd=f"{cmd} {' '.join(args)}",
        mutations_enabled=mutations,
    )
    try:
        async with asyncio.timeout(timeout):
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    listed = await session.list_tools()
                    names = [t.name for t in listed.tools]
                    result.tools = names
                    for name, arguments in tool_calls:
                        if name not in REAL_MCP_TOOLS:
                            raise ValueError(f"Refusing non-catalog MCP tool name: {name}")
                        if name not in names:
                            result.calls.append(
                                {
                                    "tool": name,
                                    "ok": False,
                                    "error": f"tool not registered on server (available={names[:20]})",
                                }
                            )
                            continue
                        try:
                            raw = await session.call_tool(name, arguments)
                            # serialize content
                            content = []
                            for block in raw.content or []:
                                if hasattr(block, "text"):
                                    content.append(block.text)
                                else:
                                    content.append(str(block))
                            result.calls.append(
                                {
                                    "tool": name,
                                    "ok": not bool(getattr(raw, "isError", False)),
                                    "content_preview": "\n".join(content)[:800],
                                }
                            )
                        except Exception as exc:  # noqa: BLE001
                            result.calls.append(
                                {"tool": name, "ok": False, "error": str(exc)[:400]}
                            )
                    result.ok = True
                    return result
    except Exception as exc:  # noqa: BLE001
        result.error = str(exc)[:600]
        return result


def call_official_mcp(
    gms_url: str,
    token: str = "",
    mutations: bool = False,
    tool_calls: list[tuple[str, dict[str, Any]]] | None = None,
    timeout: float = 45.0,
) -> OfficialMcpResult:
    """Sync wrapper used by FastAPI routes and the closed-loop runner."""
    calls = tool_calls or []
    return asyncio.run(_run_session(gms_url, token, mutations, calls, timeout=timeout))


def probe_official_mcp(gms_url: str, token: str = "", mutations: bool = False) -> OfficialMcpResult:
    """List tools only (no tool invocations)."""
    return call_official_mcp(gms_url, token, mutations, tool_calls=[], timeout=60.0)


def format_calls_for_telemetry(result: OfficialMcpResult) -> list[str]:
    lines = []
    if result.error:
        lines.append(f"official mcp error: {result.error}")
    if result.tools:
        lines.append(f"official mcp tools registered: {len(result.tools)}")
    for c in result.calls:
        status = "ok" if c.get("ok") else "fail"
        lines.append(f"{c.get('tool')} {status}")
    return lines
