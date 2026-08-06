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
| Connection chip **GMS offline** | No live catalog; quarantine is **job-local / advisory on the job** |
| `execution_mode` | Ground truth: `antigravity_closed_loop` · `demo_closed_loop` · `live_mcp` |
| Fix / MBOM tabs | Dry-run artifacts from `examples/` (scenario-correct) |
| Live tags in DataHub UI | Only when **your** GMS is up **and** `TOOLS_IS_MUTATION_ENABLED=true` |

**Click path:** open live app → pick **Hospital (Quality Circuit)** → **Run scan** → click **mart_demographics** (open) vs **mart_billing** (blocked) → Inspector **Gate** / **Fix** / **MBOM**.

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

Shipping path: **Google Antigravity** is the primary workforce (one Agent, five MidSphere stage tools on Vertex Gemini). If Antigravity is disabled or fails, a **deterministic fallback** still completes the job with honest `sim` telemetry.

Primary demo: healthcare fork (`raw → staging → mart_billing | mart_demographics`). Selective halt: **billing can quarantine while demographics stays open**.

Also demos: ecommerce PII path and NYC taxi freshness path. Command Center includes a **Forensic Time Travel** scrubber (closed-loop narrative UI, not a live GMS history browser).

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

Healthcare sample into a **local** DataHub quickstart (requires DataHub sample datasets available locally — see `scripts/README.md`):

```bash
./scripts/load_healthcare.sh
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

## Repository layout

```
frontend/          Command Center (Vercel)
backend/           Closed-loop API (Cloud Run)
examples/          Offline MBOMs, PR diffs, telemetry
skills/            Draft skills (upstream contribution path)
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
