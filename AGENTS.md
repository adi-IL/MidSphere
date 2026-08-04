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

The HTTP job path is **not** five independent LLM agents. It is a single deterministic orchestrator (`agents/pipeline.py` -> `run_closed_loop`) with named stages, then an optional Antigravity pass.

```
POST /v1/jobs
  -> run_closed_loop (deterministic)
       ContextSentinel stage
       CascadeAnalyzer stage
       CircuitBreaker stage (if auto_trip and not dry_run)
       FixArchitect stage
       MBOMEngine stage
  -> enrich_job_with_antigravity (optional Gemini summary)
  -> JobArtifact JSON
```

| Stage | Implementation | Model |
| --- | --- | --- |
| ContextSentinel | Deterministic findings on healthcare-style quality graph | none |
| CascadeAnalyzer | Deterministic selective blast radius + risk formula | none |
| CircuitBreaker | Job-local quarantine receipt; live `add_tags` only if official MCP + mutations + GMS | none |
| FixArchitect | Dry-run fix path / diff artifact | none |
| MBOMEngine | MBOM path/URN artifact; live `save_document` only if MCP mutations succeed | none |
| Operator summary | `agents/antigravity_runner.py` via Google Antigravity SDK | `gemini-3.6-flash` (default), fallback list in env |

Logical stage names appear in telemetry for the Command Center. They are not five separate `Agent(...)` sessions unless you extend the runner.

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
  "execution_mode": "demo_closed_loop | live_mcp",
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

Read: `search`, `get_entities`, `list_schema_fields`, `get_lineage`, `get_lineage_paths_between`, `get_dataset_queries`

Write: `add_tags`, `remove_tags`, `add_structured_properties`, `save_document`

### 3.3 GMS probe helper

`midsphere_mcp/client.py` also probes GMS over HTTP for reachability. That probe is not a substitute for official MCP tool calls.

## 4. Antigravity and Gemini

- Package: `google-antigravity` (see requirements.txt)
- Entry: `enrich_job_with_antigravity` after the deterministic loop
- Auth: Vertex + ADC (`GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION=global`)
- Default model: `gemini-3.6-flash`
- MCP attachment to Antigravity is optional (`ANTIGRAVITY_ATTACH_MCP`); Cloud Run defaults attach off so summary still works without spawning uvx inside the agent harness
- On failure: job still succeeds; telemetry records `antigravity unavailable` or continues without enrichment

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
| POST | `/v1/jobs/{id}/lift` | Lift quarantine |
| GET | `/v1/gate/{urn}` | Gate decision |

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
