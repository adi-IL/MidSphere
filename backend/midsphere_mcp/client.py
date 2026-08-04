"""DataHub GMS probe + optional MCP-shaped write helpers.

Live mutation tools use real unprefixed names only when GMS is reachable and
TOOLS_IS_MUTATION_ENABLED semantics are requested. Never invent datahub_* tools.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

import httpx

# Canonical MCP tool names MidSphere may emit in telemetry (subset used)
REAL_MCP_TOOLS = frozenset(
    {
        "search",
        "get_entities",
        "list_schema_fields",
        "get_lineage",
        "get_lineage_paths_between",
        "get_dataset_queries",
        "search_documents",
        "add_tags",
        "remove_tags",
        "add_structured_properties",
        "remove_structured_properties",
        "save_document",
        "update_description",
    }
)

FORBIDDEN_TOOL_PREFIXES = ("datahub_",)
FORBIDDEN_TOOLS = frozenset({"datahub_create_incident", "create_incident"})


@dataclass
class DataHubProbeResult:
    reachable: bool
    gms_url: str
    detail: str
    mutations_enabled: bool = False


@dataclass
class McpClient:
    gms_url: str
    token: str = ""
    timeout: float = 3.0
    mutations_enabled: bool = False
    last_probe: DataHubProbeResult | None = None
    tool_log: list[str] = field(default_factory=list)

    def _headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def probe(self) -> DataHubProbeResult:
        base = self.gms_url.rstrip("/")
        mutations = self.mutations_enabled or (
            os.environ.get("TOOLS_IS_MUTATION_ENABLED", "false").lower()
            in ("1", "true", "yes")
        )
        try:
            with httpx.Client(timeout=self.timeout) as client:
                # GMS health / config endpoints (OSS quickstart)
                for path in ("/health", "/config", "/"):
                    try:
                        r = client.get(f"{base}{path}", headers=self._headers())
                        if 200 <= r.status_code < 300:
                            self.last_probe = DataHubProbeResult(
                                reachable=True,
                                gms_url=base,
                                detail=f"GET {path} -> {r.status_code}",
                                mutations_enabled=mutations,
                            )
                            return self.last_probe
                    except httpx.HTTPError:
                        continue
            self.last_probe = DataHubProbeResult(
                reachable=False,
                gms_url=base,
                detail="all health probes failed",
                mutations_enabled=mutations,
            )
        except Exception as exc:  # noqa: BLE001
            self.last_probe = DataHubProbeResult(
                reachable=False,
                gms_url=base,
                detail=str(exc),
                mutations_enabled=mutations,
            )
        return self.last_probe

    def record_tool(self, name: str) -> None:
        if name in FORBIDDEN_TOOLS or name.startswith(FORBIDDEN_TOOL_PREFIXES):
            raise ValueError(f"Forbidden MCP tool name: {name}")
        self.tool_log.append(name)

    def try_graphql(self, query: str, variables: dict[str, Any] | None = None) -> dict | None:
        """Best-effort GraphQL against GMS. Returns None if unreachable."""
        if not self.last_probe or not self.last_probe.reachable:
            probe = self.probe()
            if not probe.reachable:
                return None
        base = self.gms_url.rstrip("/")
        try:
            with httpx.Client(timeout=self.timeout) as client:
                r = client.post(
                    f"{base}/api/graphql",
                    headers=self._headers(),
                    json={"query": query, "variables": variables or {}},
                )
                if r.status_code >= 400:
                    return None
                return r.json()
        except Exception:  # noqa: BLE001
            return None


def build_client_from_env() -> McpClient:
    from app.settings import get_settings

    s = get_settings()
    return McpClient(
        gms_url=s.datahub_gms_url,
        token=s.datahub_gms_token,
        mutations_enabled=s.require_mutations
        or os.environ.get("TOOLS_IS_MUTATION_ENABLED", "").lower() in ("1", "true", "yes"),
    )
