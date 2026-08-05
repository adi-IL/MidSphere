# AGENTS.md - MidSphere operations and contracts

Shipping source of truth for agent roles, MCP usage, deploy isolation, and verification.

Read ARCHITECTURE.md and DESIGN.md first. If code disagrees with this file, update this file or the code so they match.

## 0. Mandates

1. DataHub context graph is the system of record. Prefer MCP or GMS reads over inventing schemas.
2. Closed-loop jobs write advisory quarantine state when mutations are enabled and GMS is reachable; otherwise they record job-local advisory state and set `mutations_applied=false`.
3. Never claim platform-wide MCP auto-denial of quarantined entities. Consumer Gate is MidSphere policy.
4. Use real unprefixed MCP tool names only. Never invent `datahub_*` tools or MCP `create_incident`.
5. Telemetry honesty: `TOOL` / `WRITE` only after a real MCP attempt. Deterministic demo steps use `STATUS` lines prefixed with `sim `.

## 1. Runtime architecture (shipping)

Primary workforce: **Google Antigravity** Agent with five MidSphere custom tools. Deterministic stages run only as fallback when Antigravity is disabled or fails.

```
POST /v1/jobs
  -> run_closed_loop
       PRIMARY (ANTIGRAVITY_ENABLED=true, default):
         Agent(LocalAgentConfig tools=[midsphere_*], optional MCP)
           midsphere_context_sentinel_audit
           midsphere_cascade_analyzer
           midsphere_circuit_breaker_trip
           midsphere_fix_architect
           midsphere_mbom_engine
         -> JobArtifact execution_mode=antigravity_closed_loop
       FALLBACK (disabled / force / Agent error):
         run_closed_loop_fallback deterministic stages
         -> JobArtifact execution_mode=demo_closed_loop | live_mcp
```

| Stage | Primary (Antigravity tool) | Fallback | Model |
| --- | --- | --- | --- |
| ContextSentinel | `midsphere_context_sentinel_audit` | deterministic findings | Gemini via Agent |
| CascadeAnalyzer | `midsphere_cascade_analyzer` | selective blast + risk | Gemini via Agent |
| CircuitBreaker | `midsphere_circuit_breaker_trip` | job-local / live MCP tags | Gemini via Agent |
| FixArchitect | `midsphere_fix_architect` | dry-run fix path | Gemini via Agent |
| MBOMEngine | `midsphere_mbom_engine` | MBOM artifact | Gemini via Agent |

Stage tool bodies live in `agents/stage_tools.py`. Orchestration entry is `agents/pipeline.py` -> `run_closed_loop` -> `agents/antigravity_runner.py`.

## 2. Shared job artifact

```json
{
  "job_id": "uuid",
  "root_urn": "urn:li:dataset:...",
  "mode": "full | dry_run",
  "status": "succeeded",
  "findings": [],
  "blast_radius": { "risk_score": 0, "nodes": [], "selective": true },
  "quarantine": null,
  "pr": null,
  "mbom": null,
  "events": [],
  "execution_mode": "antigravity_closed_loop | demo_closed_loop | live_mcp",
  "mutations_applied": false,
  "datahub_reachable": false
}
```

## 3. DataHub MCP

### 3.1 Official server

Preferred process:

```bash
export DATAHUB_GMS_URL=...
export DATAHUB_GMS_TOKEN=...
export TOOLS_IS_MUTATION_ENABLED=true   # only when writes are intentional
uvx mcp-server-datahub@latest
```

MidSphere code path: `midsphere_mcp/official.py` launches `uvx mcp-server-datahub@latest` over stdio using the official Python `mcp` client when `USE_OFFICIAL_MCP=true`.

Cloud Run image installs `uv`/`uvx` for this path. If GMS is down, the server may fail to start; jobs continue in `demo_closed_loop` without claiming live tool success.

### 3.2 Tools

Primary closed-loop surface (docs + demos):

Read: `search`, `get_entities`, `list_schema_fields`, `get_lineage`, `get_lineage_paths_between`, `get_dataset_queries`

Write: `add_tags`, `remove_tags`, `add_structured_properties`, `save_document`

Full client allowlist also includes official tools MidSphere may call when useful: `remove_structured_properties`, `search_documents`, `update_description` (see `REAL_MCP_TOOLS` in `midsphere_mcp/client.py`). Never invent names outside that set.

### 3.3 GMS probe helper

`midsphere_mcp/client.py` also probes GMS over HTTP for reachability. That probe is not a substitute for official MCP tool calls.

## 4. Antigravity and Gemini (primary workforce)

- Package: `google-antigravity` (see requirements.txt)
- Entry: `run_job_with_antigravity` via `run_closed_loop` (primary); deterministic `run_closed_loop_fallback` on failure
- Custom tools: five `midsphere_*` callables on `LocalAgentConfig(tools=...)`
- Auth: Vertex + ADC (`GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION=global`)
- Default models: `ANTIGRAVITY_MODELS` list starting with `gemini-3.6-flash`
- MCP attachment optional (`ANTIGRAVITY_ATTACH_MCP`); Cloud Run defaults attach off to avoid uvx spawn inside the agent harness
- On failure: telemetry records `antigravity primary failed` then falls back to deterministic closed loop
- Force fallback: `ANTIGRAVITY_FORCE_FALLBACK=true` or `ANTIGRAVITY_ENABLED=false`
- Telemetry: `TOOL` events for `midsphere_*` custom tools are allowed; invented `datahub_*` names remain forbidden

## 5. Consumer Gate

Module: `gate/service.py`

- `BLOCKED` when URN is in the job quarantine set with `gateStatus=BLOCKED`
- Lift via `POST /v1/jobs/{id}/lift` clears job-local quarantine for those URNs
- Policy text must never claim global MCP denial

## 6. API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/health` | Health + stack flags |
| POST | `/v1/jobs` | Run closed loop |
| GET | `/v1/jobs/latest` | Latest job |
| GET | `/v1/jobs/{id}` | Job by id |
| POST | `/v1/jobs/{id}/lift` | Lift quarantine (job-local; optional live MCP when configured) |
| POST | `/v1/jobs/{id}/trip` | Re-run closed loop with `auto_trip` for same root |
| GET | `/v1/gate/{urn}` | Gate decision against latest job |
| GET | `/v1/gate-default-blocked` | Convenience gate for healthcare billing URN |

## 7. Deploy isolation

| Directory | Deploy |
| --- | --- |
| `frontend/` | Vercel project `midsphere` only |
| `backend/` | GCP Cloud Run `midsphere-api` only |

Git identity for this repo:

```bash
git config user.name "adi-IL"
git config user.email "adi-IL@users.noreply.github.com"
```

## 8. Sample data

Healthcare: ingest + lineage + metadata scripts under static-assets datasets (not `datapack load healthcare`).

```bash
./scripts/load_healthcare.sh
```

## 9. Verification

- Unit tests: `backend/tests/test_pipeline_and_gate.py` (honest `sim` telemetry, gate lift)
- Manual: health, POST job, gate BLOCKED, lift, gate not BLOCKED
- Production: Cloud Run + Vercel with frontend `VITE_API_BASE_URL` pointing at Cloud Run

## 10. Security

- No secrets in git
- Strip shell metacharacters from CLI-wrapped inputs
- No destructive SQL in fix suggestions without explicit override
