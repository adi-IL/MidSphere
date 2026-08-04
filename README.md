# MidSphere

```
   __  ___  _     _______       __
  /  |/  / (_)___/ / ___/____  / /_  ___  _______
 / /|_/ / / / __  /\__ \/ __ \/ __ \/ _ \/ ___/ _ \
/ /  / / / / /_/ /___/ / /_/ / / / /  __/ /  /  __/
/_/  /_/_/\__,_//____/ .___/_/ /_/\___/_/   \___/
                      /_/
```

### Autonomous Context Command and Circuit-Breaker Engine
*Powered by [DataHub](https://datahub.com) · MCP · Antigravity · Gemini*

Organizations ship AI agents faster than they ship trustworthy context.
When schema drift, bad quality, PII leaks, or orphan ownership hit the catalog, the failure does not stop at Slack.
**Context Entropy** sets in, and every agent still reading DataHub inherits the damage.

Traditional catalogs often act as **passive death certificates**: they log what broke, fire an alert that dies in scrollback, and leave Cursor, Claude, Analytics Agent, and Text-to-SQL bots hallucinating on corrupted metadata.

**MidSphere does not stop at the death certificate.**
It **trips a circuit breaker inside DataHub's context graph**: advisory quarantine, selective blast-radius halt, metadata-aware fix artifacts, and a durable **Model Bill of Materials (MBOM)** so the next human and the next agent inherit permanent knowledge.

Quarantine is **advisory graph state** (tags, structured properties, documents). MidSphere **Consumer Gate** enforces `BLOCKED` for MidSphere-aware clients. We do **not** claim that every third-party MCP consumer is auto-denied by the platform alone.

Built for [Build with DataHub: The Agent Hackathon](https://datahub.devpost.com/).

## Live

| Surface | URL |
| --- | --- |
| Command Center | https://midsphere.vercel.app |
| API (Cloud Run) | https://midsphere-api-1053689941073.us-central1.run.app |
| Source | https://github.com/adi-IL/MidSphere-datahb |

## The closed loop

| Stage | Role | What happens |
| --- | --- | --- |
| **1. Audit** | `ContextSentinel` | Quality, PII, ownership signals |
| **2. Topology** | `CascadeAnalyzer` | Blast radius + risk 0-100 (selective impact) |
| **3. Break** | `CircuitBreaker` | Tags + structured properties (`gate_status=BLOCKED`) |
| **4. Fix** | `FixArchitect` | SQL/dbt fix artifact (PR or dry-run path) |
| **5. Inherit** | `MBOMEngine` | MBOM attestation via `save_document` contract |

```
Trigger -> Sentinel -> Cascade -> Breaker -> Fix -> MBOM
              |           |         |
              +---- DataHub MCP (read + mutation write-back when enabled) ----+
```

Shipping path: stages run as a **deterministic orchestrator** in `run_closed_loop`. After the loop, **Google Antigravity** can produce an operator summary with Gemini models on Vertex (ADC). Live MCP tool calls use official `mcp-server-datahub` when configured; offline jobs use honest `sim` telemetry and never fake mutation success.

Primary demo: healthcare forking pipeline (`raw -> staging -> mart_billing | mart_demographics`). Selective halt: billing path can quarantine while demographics stays open.

## Stack (shipping)

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind, React Flow, Geist |
| Backend | FastAPI, Pydantic, httpx, uvicorn |
| Orchestrator | Deterministic closed-loop stages (`backend/agents/pipeline.py`) |
| Agent runtime | [Google Antigravity SDK](https://github.com/google-antigravity/antigravity-sdk-python) (`google-antigravity`) for post-loop summary |
| Models | Gemini via Vertex + ADC (`gemini-3.6-flash` default; `gemini-3.1-pro-preview` and other IDs configurable via `ANTIGRAVITY_MODELS`) |
| Catalog | DataHub GMS + official [mcp-server-datahub](https://github.com/acryldata/mcp-server-datahub) via `uvx` stdio |
| Deploy | Vercel (`midsphere`) · GCP Cloud Run (`midsphere-api`) |

Why Gemini with Antigravity: the Antigravity agent runtime is backed by Gemini on Vertex in this project. Antigravity is the agent harness; Gemini is the model family it calls. Model list is env-configurable, not hard-locked to a single SKU.

## MCP tools (real names only)

**Read:** `search` · `get_entities` · `list_schema_fields` · `get_lineage` · `get_lineage_paths_between` · `get_dataset_queries`

**Write** (`TOOLS_IS_MUTATION_ENABLED=true` on the MCP server): `add_tags` · `remove_tags` · `add_structured_properties` · `save_document`

No invented `datahub_*` prefixes. No MCP `create_incident`.

Telemetry honesty: live MCP attempts emit `TOOL` events; demo steps emit `STATUS` lines starting with `sim `. When GMS is offline, `execution_mode=demo_closed_loop` and `mutations_applied=false`.

## Quick start

```bash
git clone https://github.com/adi-IL/MidSphere-datahb.git
cd MidSphere-datahb
cp .env.example .env
# set GOOGLE_CLOUD_PROJECT (or rely on gcloud ADC project)
# set DATAHUB_GMS_URL / DATAHUB_GMS_TOKEN for live catalog

# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTIGRAVITY_ENABLED=true
export ANTIGRAVITY_MODELS=gemini-3.6-flash,gemini-3.1-pro-preview
export USE_OFFICIAL_MCP=true
# optional live writes:
# export TOOLS_IS_MUTATION_ENABLED=true
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Healthcare sample (local DataHub quickstart + dataset scripts):

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
| GET | `/v1/gate/{urn}` | Consumer Gate decision |

## Repository layout

```
frontend/          Command Center (Vercel)
backend/           Swarm API (Cloud Run)
skills/            OSS skill drafts
examples/          Offline MBOMs, diffs, telemetry
scripts/           Bootstrap helpers
ARCHITECTURE.md    System design
DESIGN.md          Command Center UI
AGENTS.md          Ops contracts
```

## Docs for builders

1. [ARCHITECTURE.md](./ARCHITECTURE.md)
2. [DESIGN.md](./DESIGN.md)
3. [AGENTS.md](./AGENTS.md)

## License

Apache License 2.0. See [LICENSE](./LICENSE).

---

*MidSphere: when context goes bad, trip the breaker. Do not print another death certificate.*
