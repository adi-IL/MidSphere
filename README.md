# MidSphere

<p align="center">
  <img src="frontend/public/logo.png" alt="MidSphere — Autonomous Context Circuit-Breaker Engine" width="360" />
</p>

<p align="center">
  <strong>Autonomous Context Circuit-Breaker Engine for Data Platforms</strong><br />
  <em>Powered by <a href="https://datahub.com">DataHub</a> · MCP · Antigravity · Gemini</em>
</p>

Organizations ship AI agents faster than they ship trustworthy context.
When schema drift, bad quality, PII leaks, or orphan ownership hit the catalog, the failure does not stop at Slack.
**Context Entropy** sets in, and every agent still reading DataHub inherits the damage.

Traditional catalogs often act as **passive death certificates**: they log what broke, fire an alert that dies in scrollback, and leave Cursor, Claude, Analytics Agent, and Text-to-SQL bots hallucinating on corrupted metadata.

**MidSphere does not stop at the death certificate.**
It **trips a circuit breaker** on bad context: advisory quarantine, selective blast-radius halt, metadata-aware fix artifacts, and a durable **MBOM** attestation path so the next human and the next agent can inherit safer knowledge.

Quarantine is **advisory graph state** (tags, structured properties, documents) when DataHub mutations are live.
Otherwise it is **job-local** with `mutations_applied=false`.
MidSphere **Consumer Gate** enforces `BLOCKED` for MidSphere-aware clients.
We do **not** claim that every third-party MCP consumer is auto-denied by the platform alone.

Built for [Build with DataHub: The Agent Hackathon](https://datahub.devpost.com/).

## Live

| Surface | URL |
| --- | --- |
| Command Center | https://midsphere.vercel.app |
| API (Cloud Run) | https://midsphere-api-1053689941073.us-central1.run.app |
| Source | https://github.com/adi-IL/MidSphere-datahb |

### What is real vs offline (60 seconds)

| You see | Meaning |
| --- | --- |
| **Run scan** succeeds | Closed loop ran (Antigravity and/or deterministic fallback) |
| Connection / health **GMS reachable** | API can probe live DataHub GMS (`datahub_reachable=true`) |
| Connection chip **GMS offline** | No live catalog; quarantine is **job-local / advisory on the job** |
| `execution_mode` | Ground truth: `antigravity_closed_loop` · `demo_closed_loop` · `live_mcp` |
| Fix / MBOM tabs | Dry-run artifacts from `examples/` (scenario-correct) |
| Live tags / `save_document` | GMS up **and** `TOOLS_IS_MUTATION_ENABLED=true` → `mutations_applied=true` in the job |
| Chip **API · closed loop · GMS live** | Frontend reached Cloud Run and GMS probe succeeded |

**Click path (any scenario):** open live app → pick **Hospital**, **E-Commerce**, or **NYC Taxi** → **Run scan** → selective graph (one open fork) → Inspector **Gate** / **Fix** / **MBOM** → terminal shows `official_mcp ok` when live.

## The closed loop

| Stage | Role | Shipping behavior |
| --- | --- | --- |
| **1. Audit** | `ContextSentinel` | Quality / PII / freshness findings (scenario packs) |
| **2. Topology** | `CascadeAnalyzer` | Blast radius + risk 0–100 (selective impact) |
| **3. Break** | `CircuitBreaker` | Advisory quarantine receipt; live tags only if GMS + mutations |
| **4. Fix** | `FixArchitect` | SQL/dbt dry-run path under `examples/prs/` |
| **5. Inherit** | `MBOMEngine` | MBOM path under `examples/mboms/`; live `save_document` only if mutations |

```
Trigger → Sentinel → Cascade → Breaker → Fix → MBOM
              |           |         |
              +---- DataHub MCP when GMS configured (read + optional writes) ----+
```

Shipping path: **Google Antigravity is the primary workforce** (required dependency — one Agent, five MidSphere stage tools on Vertex Gemini, with official DataHub MCP attached when GMS is reachable). Stage tools call live MCP (`get_lineage`, `list_schema_fields`, `add_tags`, `save_document`) when mutations are enabled. If Antigravity fails, a **deterministic fallback** still completes the job with honest `sim` telemetry when offline.

**Scenarios (all first-class):**

| Scenario | Risk | Blocked fork | Open fork |
| --- | --- | --- | --- |
| Hospital (healthcare) | 61 | `mart_billing` | `mart_demographics` |
| E-Commerce (PII) | 88 | `mart_customer_360` | `mart_product_catalog` |
| NYC Taxi (freshness) | 65 | `mart_monthly_revenue` | `mart_trip_distance_stats` |

Command Center includes a **Forensic Time Travel** scrubber (closed-loop narrative UI, not a live GMS history browser).

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind, React Flow, Geist |
| Backend | FastAPI, Pydantic, httpx, uvicorn |
| Primary workforce | [Google Antigravity](https://github.com/google-antigravity/antigravity-sdk-python) + `backend/agents/stage_tools.py` |
| Fallback | Deterministic stages (`backend/agents/pipeline.py`) |
| Models | Gemini via Vertex + ADC |
| Catalog | DataHub GMS + official [mcp-server-datahub](https://github.com/acryldata/mcp-server-datahub) via `uvx` |
| Deploy | Vercel (`midsphere`) · GCP Cloud Run (`midsphere-api`) |

## MCP tools (real names only)

**Read:** `search` · `get_entities` · `list_schema_fields` · `get_lineage` · `get_lineage_paths_between` · `get_dataset_queries`

**Write** (`TOOLS_IS_MUTATION_ENABLED=true` on the MCP server): `add_tags` · `remove_tags` · `add_structured_properties` · `save_document`

No invented `datahub_*` prefixes. No MCP `create_incident`.

## Quick start

```bash
git clone https://github.com/adi-IL/MidSphere-datahb.git
cd MidSphere-datahb
cp .env.example .env
# optional live catalog: DATAHUB_GMS_URL / DATAHUB_GMS_TOKEN
# Vertex: GOOGLE_CLOUD_PROJECT + ADC

cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTIGRAVITY_ENABLED=true
export USE_OFFICIAL_MCP=true
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# other terminal
cd frontend && npm install && npm run dev
```

Live catalog for Cloud Run cannot be laptop `localhost`. Operators run official DataHub **quickstart on GCE** and point `DATAHUB_GMS_URL` at the VM public IP (see `scripts/README.md`). Cost control:

```bash
./scripts/gce_datahub_schedule.sh apply     # auto start weekdays / stop nightly
./scripts/gce_datahub_schedule.sh stop-now  # stop immediately
./scripts/gce_datahub_schedule.sh start-now # start for a demo
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/health` | Health + stack metadata |
| POST | `/v1/jobs` | Run closed loop |
| GET | `/v1/jobs/latest` | Latest job |
| GET | `/v1/jobs/{id}` | Job by id |
| POST | `/v1/jobs/{id}/lift` | Lift quarantine |
| POST | `/v1/jobs/{id}/trip` | Re-run closed loop with auto-trip |
| GET | `/v1/gate/{urn}` | Consumer Gate decision |
| GET | `/v1/gate-default-blocked` | Convenience gate for demo billing URN |

## Open-source contribution (bonus)

Upstream skills PR (open, CI green):  
**[datahub-project/datahub-skills#88](https://github.com/datahub-project/datahub-skills/pull/88)** — `datahub-circuit-breaker` + `datahub-quality-circuit` (advisory quarantine + selective halt).

Local mirrors: [skills/](./skills/).

## Repository layout

```
frontend/          Command Center (Vercel)
backend/           Closed-loop API (Cloud Run)
examples/          Offline MBOMs, PR diffs, telemetry
skills/            Upstream skill mirrors (see PR #88)
scripts/           Local bootstrap helpers
ARCHITECTURE.md    Shipping architecture (short)
.github/           Path-filtered CI + deploy
```

## Docs

1. [ARCHITECTURE.md](./ARCHITECTURE.md) — shipping system contracts  
2. [examples/README.md](./examples/README.md) — offline judge artifacts  
3. [backend/README.md](./backend/README.md) · [frontend/README.md](./frontend/README.md)  
4. [`.github/DEPLOY.md`](./.github/DEPLOY.md) — deploy isolation  

## License

Apache License 2.0. See [LICENSE](./LICENSE).

---

*MidSphere: when context goes bad, trip the breaker. Do not print another death certificate.*
