# MidSphere shipping architecture

Closed-loop context circuit-breaker for DataHub. This document describes only behaviors that ship today.

## Summary

MidSphere runs a multi-stage closed loop on a root dataset URN: audit findings, selective blast radius, advisory quarantine, dry-run fix artifact, MBOM attestation path.

**Primary workforce:** [Google Antigravity](https://github.com/google-antigravity/antigravity-sdk-python) Agent with five MidSphere stage tools on Vertex Gemini (required dependency). Official DataHub MCP attaches when GMS is reachable. Stage tools call live MCP reads and writes when mutations are enabled.

When GMS is down or mutations are disabled, quarantine stays **job-local** with `mutations_applied=false`. **Consumer Gate** is MidSphere policy. It is not platform-wide MCP auto-denial.

## Challenge fit

**Agents That Do Real Work:** closed loop with graph write-back when GMS and mutations are enabled.  
Secondary: dry-run fix artifacts under `examples/prs/`.  
Three packs: healthcare, ecommerce (PII), NYC taxi (freshness).

## Runtime

```
POST /v1/jobs
  -> run_closed_loop
       PRIMARY: Antigravity Agent
                tools = [midsphere_*] + optional MCP (mcp-server-datahub)
                stage tools -> get_lineage / add_tags / save_document when configured
       FALLBACK: deterministic pipeline.py if Agent fails
  -> JobArtifact
```

| Stage | Tool | Shipping behavior |
| --- | --- | --- |
| Audit | `midsphere_context_sentinel_audit` | Scenario findings; live MCP reads when GMS is up |
| Cascade | `midsphere_cascade_analyzer` | Selective nodes and risk (healthcare 61 / ecommerce 88 / nyctaxi 65) |
| Break | `midsphere_circuit_breaker_trip` | Live `add_tags` when mutations are on; else job-local |
| Fix | `midsphere_fix_architect` | Dry-run path under `examples/prs/*` |
| MBOM | `midsphere_mbom_engine` | Live `save_document` when mutations are on; else `examples/mboms/*` |

Shared packs: `backend/agents/scenarios.py`.

`execution_mode` values: `antigravity_closed_loop` | `demo_closed_loop` | `live_mcp`.

## Selective halt

| Scenario | Quarantine target | Open fork |
| --- | --- | --- |
| Healthcare | `mart_billing` | `mart_demographics` |
| Ecommerce | `mart_customer_360` | `mart_product_catalog` |
| NYC taxi | `mart_monthly_revenue` | `mart_trip_distance_stats` |

Risk scores and paths are the closed-loop defaults defined in `scenarios.py` (not live warehouse computation).

## DataHub MCP (real names only)

**Read:** `search`, `get_entities`, `list_schema_fields`, `get_lineage`, `get_lineage_paths_between`, `get_dataset_queries`

**Write** (`TOOLS_IS_MUTATION_ENABLED=true`): `add_tags`, `remove_tags`, `add_structured_properties`, `save_document`

Never invent `datahub_*` tools or MCP `create_incident`.  
Client: `uvx mcp-server-datahub@latest` (`midsphere_mcp/official.py`).

## Live GMS (hackathon)

Cloud Run does not use laptop `localhost` for GMS. Shipping approach:

1. GCE VM runs official `datahub docker quickstart`.  
2. Firewall allows GMS port 8080 (and UI 9002 if needed).  
3. `midsphere-api` env: `DATAHUB_GMS_URL=http://EXTERNAL_IP:8080`, mutations enabled, `ANTIGRAVITY_ATTACH_MCP=true`.  
4. Cost control: instance schedule via `scripts/gce_datahub_schedule.sh` (start-now also re-points Cloud Run).

Heavier alternative: [DataHub on GKE](https://docs.datahub.com/docs/deploy/gcp).

## Consumer Gate

`GET /v1/gate/{urn}` against the latest job quarantine set.  
Lift: `POST /v1/jobs/{id}/lift` (job-local; optional live MCP when configured).

## Command Center (frontend)

Minimal monochrome shell (no emoji). Default layout:

| Region | Role |
| --- | --- |
| Top | Scenario segments (Hospital, Retail, Taxi), Live / GMS status, **Run** |
| Left Pipeline | Run kind (Sample / Agent / Live MCP), metrics strip, stage stepper; Telemetry collapsed by default |
| Center | Selective lineage graph; optional Timeline (narrative only) |
| Right Decision | Findings, Gate, Attestation (plus More); sticky Trip / Lift |

`VITE_API_BASE_URL` is baked at build time to Cloud Run. Empty or incorrect base yields Offline status and sample fixtures.

## Deploy isolation

| Tree | Target |
| --- | --- |
| `frontend/` | Vercel `midsphere` (`VITE_API_BASE_URL` to Cloud Run) |
| `backend/` | Cloud Run `midsphere-api` |

## Claims this project does not make

- Platform-wide MCP auto-denial of quarantined entities  
- Multiple independent AI agents (one Agent, five stage tools)  
- Stock sample URNs always matching without ingest  
- Fix PRs always opened on GitHub (dry-run paths are first-class)  
- Live risk scores computed from warehouse metrics (scenario defaults apply)

## Layout

```
frontend/     Command Center
backend/      FastAPI, Antigravity, gate, MCP client
examples/     MBOMs, PR diffs, job fixture, sample telemetry
skills/       Upstream skill mirrors (PR #88)
scripts/      Bootstrap and GCE schedule helpers
ARCHITECTURE.md
README.md
LICENSE
```

## OSS skills

Open PR: [datahub-project/datahub-skills#88](https://github.com/datahub-project/datahub-skills/pull/88).
