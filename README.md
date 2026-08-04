# MidSphere

Autonomous context circuit-breaker for [DataHub](https://datahub.com).

```
   __  ___  _     _______       __
  /  |/  / (_)___/ / ___/____  / /_  ___  _______
 / /|_/ / / / __  /\__ \/ __ \/ __ \/ _ \/ ___/ _ \
/ /  / / / / /_/ /___/ / /_/ / / / /  __/ /  /  __/
/_/  /_/_/\__,_//____/ .___/_/ /_/\___/_/   \___/
                      /_/
```

MidSphere watches a DataHub context graph for quality and governance failures, scores selective blast radius on lineage, writes advisory quarantine metadata, opens fix artifacts, and publishes MBOM-style attestations so the next human or agent inherits safer context.

It does not claim that DataHub MCP automatically blocks every third-party reader. Quarantine is advisory graph state. MidSphere Consumer Gate enforces `BLOCKED` for MidSphere-aware clients.

Built for [Build with DataHub: The Agent Hackathon](https://datahub.devpost.com/).

## Live

| Surface | URL |
| --- | --- |
| Command Center | https://midsphere.vercel.app |
| API (Cloud Run) | https://midsphere-api-1053689941073.us-central1.run.app |
| Source | https://github.com/adi-IL/MidSphere-datahb |

## How it works

```
Scan root URN
  -> ContextSentinel   findings (quality, PII, ownership signals)
  -> CascadeAnalyzer   blast radius + risk 0-100 (selective impact)
  -> CircuitBreaker    tags + structured properties (advisory)
  -> FixArchitect      SQL/dbt fix artifact (PR or dry-run path)
  -> MBOMEngine        document reference via save_document contract
```

Primary demo graph: healthcare forking pipeline (`raw -> staging -> mart_billing | mart_demographics`). Billing issues quarantine billing; demographics can stay open.

## Stack (shipping)

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind, React Flow, Geist |
| Backend | FastAPI, Pydantic, httpx, uvicorn |
| Agents | Google Antigravity SDK + Gemini (`gemini-3.6-flash` / `gemini-3.1-pro-preview`) on the job path when Vertex ADC allows; deterministic closed loop always runs |
| Catalog | DataHub GMS + official [mcp-server-datahub](https://github.com/acryldata/mcp-server-datahub) via `uvx` stdio (`mcp` Python client) |
| Deploy | Frontend: Vercel project `midsphere`. Backend: GCP Cloud Run `midsphere-api` |

Install paths match this repo: `pip install -r backend/requirements.txt` and `npm install` under `frontend/`.

## MCP tools (real names only)

Read: `search`, `get_entities`, `list_schema_fields`, `get_lineage`, `get_lineage_paths_between`, `get_dataset_queries`

Write (requires `TOOLS_IS_MUTATION_ENABLED=true` on the MCP server process): `add_tags`, `remove_tags`, `add_structured_properties`, `save_document`

No `datahub_*` prefixes. No MCP `create_incident` (Cloud GraphQL only when tier allows).

When GMS or official MCP is offline, jobs still complete in `execution_mode=demo_closed_loop` and set `mutations_applied=false`. Live writes are never claimed without a successful path.

## Quick start

```bash
git clone https://github.com/adi-IL/MidSphere-datahb.git
cd MidSphere-datahb
cp .env.example .env

# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export GOOGLE_CLOUD_PROJECT=project-dace7531-ac79-4f81-bd2
export ANTIGRAVITY_MODELS=gemini-3.6-flash
export USE_OFFICIAL_MCP=true
# optional live catalog:
# export DATAHUB_GMS_URL=... DATAHUB_GMS_TOKEN=... TOOLS_IS_MUTATION_ENABLED=true
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Frontend (other terminal)
cd frontend
npm install
npm run dev
```

Sample healthcare load (local DataHub quickstart + clone of static-assets datasets):

```bash
./scripts/load_healthcare.sh
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/health` | Service + stack metadata |
| POST | `/v1/jobs` | Run closed loop `{ root_urn, mode, auto_trip }` |
| GET | `/v1/jobs/latest` | Latest job artifact |
| GET | `/v1/jobs/{id}` | Job by id |
| POST | `/v1/jobs/{id}/lift` | Lift quarantine |
| GET | `/v1/gate/{urn}` | Consumer Gate decision |

## Repository layout

```
frontend/     Command Center (Vercel)
backend/      Swarm API (Cloud Run)
skills/       OSS skill drafts (circuit-breaker, quality-circuit)
examples/     Offline MBOMs, diffs, telemetry
scripts/      Bootstrap helpers
ARCHITECTURE.md  DESIGN.md  AGENTS.md
```

## License

Apache License 2.0. See [LICENSE](./LICENSE).
