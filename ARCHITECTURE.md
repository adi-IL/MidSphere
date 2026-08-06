# MidSphere — shipping architecture

**Closed-loop context circuit-breaker for DataHub.**  
Honest contracts only: what demos today, not a roadmap novel.

## One-liner

MidSphere runs a **multi-stage** closed loop on a root dataset URN: audit findings → selective blast radius → **advisory** quarantine → dry-run fix artifact → MBOM attestation path. When DataHub GMS is reachable and mutations are enabled, it can write tags / structured properties / documents via official MCP. Offline (or mutations off), quarantine stays **job-local** with `mutations_applied=false`.

It is **not** a claim that MCP auto-denies every third-party agent. **Consumer Gate** is MidSphere policy for MidSphere-aware clients.

## Primary challenge fit

**Agents That Do Real Work** — closed loop with optional graph write-back.  
Secondary: metadata-aware **fix examples** under `examples/prs/` (dry-run).  
ML-lane / leakage audits are **not** the shipping demo.

## Runtime

```
POST /v1/jobs
  → run_closed_loop
       PRIMARY: Google Antigravity Agent + five midsphere_* tools (Vertex Gemini)
       FALLBACK: deterministic stages in pipeline.py
  → JobArtifact
```

| Stage | Tool / fallback | Shipping behavior |
| --- | --- | --- |
| Audit | `midsphere_context_sentinel_audit` | Scenario pack findings (healthcare / ecommerce / nyctaxi) |
| Cascade | `midsphere_cascade_analyzer` | Selective nodes + risk score |
| Break | `midsphere_circuit_breaker_trip` | Job-local quarantine; live `add_tags` only if GMS + mutations |
| Fix | `midsphere_fix_architect` | Dry-run path → `examples/prs/*` |
| MBOM | `midsphere_mbom_engine` | Path → `examples/mboms/*`; live `save_document` only if mutations |

Shared packs: `backend/agents/scenarios.py`.

`execution_mode`: `antigravity_closed_loop` | `demo_closed_loop` | `live_mcp`.

## Selective halt (healthcare demo)

```
raw_patients → staging_patients → mart_billing        [quarantine target]
                               → mart_demographics   [open fork]
```

Risk defaults: healthcare **61**, ecommerce **88**, nyctaxi **65**.

## DataHub MCP (real names only)

**Read (when live):** `search`, `get_entities`, `list_schema_fields`, `get_lineage` (downstream for blast story), `get_lineage_paths_between`, `get_dataset_queries`  

**Write (mutations on):** `add_tags`, `remove_tags`, `add_structured_properties`, `save_document`  

Never invent `datahub_*` tools or MCP `create_incident`.  
Official server: `uvx mcp-server-datahub@latest` (`midsphere_mcp/official.py`).

## Consumer Gate

`GET /v1/gate/{urn}` against the latest job quarantine set.  
`BLOCKED` only for URNs in the active set with `gateStatus=BLOCKED`.  
Lift: `POST /v1/jobs/{id}/lift` (job-local; live remove when mutations path is wired and enabled).

## Deploy isolation

| Tree | Target |
| --- | --- |
| `frontend/` | Vercel project `midsphere` |
| `backend/` | Cloud Run `midsphere-api` |

## What we do **not** claim

- Platform-wide MCP auto-denial of quarantined entities  
- Always-on live graph mutations on the public demo  
- Multi-independent agent swarm (one Agent harness + five stage tools)  
- Stock healthcare includes mlModel target leakage  
- Fix PRs always opened on GitHub (dry-run paths are first-class)

## Layout

```
frontend/     Command Center
backend/      FastAPI + agents + gate + MCP client
examples/     MBOMs, PR diffs, job fixtures, telemetry
skills/       Draft skills for possible upstream
scripts/      Local bootstrap helpers
ARCHITECTURE.md  (this file)
README.md
LICENSE
```

Live: [midsphere.vercel.app](https://midsphere.vercel.app) · API on Cloud Run (see README).

## OSS skills (bonus path)

Open PR: [datahub-project/datahub-skills#88](https://github.com/datahub-project/datahub-skills/pull/88) — `datahub-circuit-breaker` + `datahub-quality-circuit`.
