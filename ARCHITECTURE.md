# MidSphere — shipping architecture

**Closed-loop context circuit-breaker for DataHub.**  
Honest contracts only: what demos today.

## One-liner

MidSphere runs a **multi-stage** closed loop on a root dataset URN: audit findings → selective blast radius → **advisory** quarantine → dry-run fix artifact → MBOM attestation path.

**Primary workforce:** [Google Antigravity](https://github.com/google-antigravity/antigravity-sdk-python) Agent + five MidSphere stage tools on Vertex Gemini (required dependency, not optional). Official DataHub MCP is attached when GMS is reachable; stage tools call live MCP reads/writes when mutations are enabled.

Offline (or GMS down), quarantine stays **job-local** with `mutations_applied=false`. **Consumer Gate** is MidSphere policy — not platform-wide MCP auto-denial.

## Challenge fit

**Agents That Do Real Work** — closed loop with graph write-back when GMS + mutations are on.  
Secondary: fix artifacts under `examples/prs/` (dry-run).  
Three demo packs: **healthcare**, **ecommerce (PII)**, **NYC taxi (freshness)**.

## Runtime

```
POST /v1/jobs
  → run_closed_loop
       PRIMARY: Antigravity Agent
                tools = [midsphere_*] + optional MCP server (mcp-server-datahub)
                stage tools → official MCP get_lineage / add_tags / save_document
       FALLBACK: deterministic pipeline.py (if Agent fails)
  → JobArtifact
```

| Stage | Tool | Shipping behavior |
| --- | --- | --- |
| Audit | `midsphere_context_sentinel_audit` | Scenario findings + live MCP reads when GMS up |
| Cascade | `midsphere_cascade_analyzer` | Selective nodes + risk (healthcare 61 / ecommerce 88 / nyctaxi 65) |
| Break | `midsphere_circuit_breaker_trip` | Live `add_tags` when mutations on; else job-local |
| Fix | `midsphere_fix_architect` | Dry-run path → `examples/prs/*` |
| MBOM | `midsphere_mbom_engine` | Live `save_document` when mutations on; else `examples/mboms/*` |

Shared packs: `backend/agents/scenarios.py`.

`execution_mode`: `antigravity_closed_loop` | `demo_closed_loop` | `live_mcp`.

## Selective halt

| Scenario | Quarantine target | Open fork |
| --- | --- | --- |
| Healthcare | `mart_billing` | `mart_demographics` |
| Ecommerce | `mart_customer_360` | `mart_product_catalog` |
| NYC taxi | `mart_monthly_revenue` | `mart_trip_distance_stats` |

## DataHub MCP (real names only)

**Read:** `search`, `get_entities`, `list_schema_fields`, `get_lineage` (downstream), `get_lineage_paths_between`, `get_dataset_queries`  

**Write** (`TOOLS_IS_MUTATION_ENABLED=true`): `add_tags`, `remove_tags`, `add_structured_properties`, `save_document`  

Never invent `datahub_*` tools or MCP `create_incident`.  
Client: `uvx mcp-server-datahub@latest` (`midsphere_mcp/official.py`).

## Live GMS (hackathon)

Cloud Run does not use laptop `localhost`. Shipping approach:

1. **GCE VM** runs official `datahub docker quickstart` (same stack as local quickstart).  
2. Firewall opens GMS **:8080** (and UI **:9002**).  
3. `midsphere-api` env: `DATAHUB_GMS_URL=http://EXTERNAL_IP:8080`, mutations + `ANTIGRAVITY_ATTACH_MCP=true`.  
4. **Cost control:** instance schedule auto-stops the VM off-hours — `scripts/gce_datahub_schedule.sh`.

Official heavier alternative: [DataHub on GKE](https://docs.datahub.com/docs/deploy/gcp).

## Consumer Gate

`GET /v1/gate/{urn}` against the latest job quarantine set.  
Lift: `POST /v1/jobs/{id}/lift` (job-local).

## Deploy isolation

| Tree | Target |
| --- | --- |
| `frontend/` | Vercel `midsphere` (`VITE_API_BASE_URL` → Cloud Run) |
| `backend/` | Cloud Run `midsphere-api` |

## What we do **not** claim

- Platform-wide MCP auto-denial of quarantined entities  
- Multi-independent agent swarm (one Agent + five stage tools)  
- Stock samples always match demo URNs 1:1 without ingest  
- Fix PRs always opened on GitHub (dry-run paths are first-class)

## Layout

```
frontend/     Command Center
backend/      FastAPI + Antigravity + gate + MCP client
examples/     MBOMs, PR diffs, job fixtures, telemetry
skills/       Upstream skill mirrors (PR #88)
scripts/      Bootstrap + GCE schedule helpers
ARCHITECTURE.md
README.md
LICENSE
```

## OSS skills (bonus)

Open PR: [datahub-project/datahub-skills#88](https://github.com/datahub-project/datahub-skills/pull/88).
