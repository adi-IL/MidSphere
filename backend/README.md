# backend/

FastAPI closed-loop API for MidSphere.

**Deploy target:** GCP Cloud Run `midsphere-api` only. Do not package `frontend/` here.

## Layout (shipping)

```
backend/
├── app/              # FastAPI entry (main, settings)
├── api/              # REST /v1/* (jobs, gate, health, trip, lift)
├── agents/           # pipeline, antigravity_runner, stage_tools
├── gate/             # Consumer Gate policy (OPEN | BLOCKED | LIFTED)
├── midsphere_mcp/    # GMS probe + official mcp-server-datahub client
├── models/           # Pydantic job / finding / blast / quarantine artifacts
├── tests/            # pytest (honest sim telemetry + gate)
├── requirements.txt
├── Dockerfile
└── cloudrun-env.yaml # non-secret Cloud Run env (mutations off by default)
```

## Contracts

Root [ARCHITECTURE.md](../ARCHITECTURE.md) is the shipping contract: Antigravity primary path, MCP tool names, job artifact schema, deploy isolation.

## Local

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTIGRAVITY_ENABLED=true   # or false for deterministic fallback only
export USE_OFFICIAL_MCP=true
# optional: DATAHUB_GMS_URL, DATAHUB_GMS_TOKEN, TOOLS_IS_MUTATION_ENABLED
# Vertex: GOOGLE_CLOUD_PROJECT + ADC
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

Tests (deterministic):

```bash
ANTIGRAVITY_ENABLED=false USE_OFFICIAL_MCP=false python -m pytest tests/ -q
```

## API surface

| Method | Path |
| --- | --- |
| GET | `/v1/health` |
| POST | `/v1/jobs` |
| GET | `/v1/jobs/latest` |
| GET | `/v1/jobs/{id}` |
| POST | `/v1/jobs/{id}/lift` |
| POST | `/v1/jobs/{id}/trip` |
| GET | `/v1/gate/{urn}` |
| GET | `/v1/gate-default-blocked` |

## Deploy

Path-filtered GitHub Actions → Cloud Run via Workload Identity Federation. See [`.github/DEPLOY.md`](../.github/DEPLOY.md).

Status: **shipping** (Antigravity primary + deterministic fallback).
