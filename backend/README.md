# backend/

FastAPI closed-loop API for MidSphere.

**Deploy target:** GCP Cloud Run `midsphere-api` only. Do not package `frontend/` here.

## Layout (shipping)

```
backend/
├── app/              # FastAPI entry (main, settings)
├── api/              # REST /v1/* (jobs, gate, health, trip, lift)
├── agents/           # pipeline, antigravity_runner, stage_tools, scenarios
├── gate/             # Consumer Gate policy (OPEN | BLOCKED | LIFTED)
├── midsphere_mcp/    # GMS probe + official mcp-server-datahub client
├── models/           # Pydantic job / finding / blast / quarantine artifacts
├── tests/            # pytest (honest sim telemetry + gate)
├── requirements.txt
├── Dockerfile
└── cloudrun-env.yaml # defaults; live GMS URL often set via gcloud after deploy
```

## Contracts

Root [ARCHITECTURE.md](../ARCHITECTURE.md): **Antigravity is primary** (required). Official MCP attaches when GMS is reachable; stage tools call live `get_lineage` / `add_tags` / `save_document` when mutations are on. Scenarios: healthcare, ecommerce, nyctaxi.

## Local

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTIGRAVITY_ENABLED=true    # primary workforce
export USE_OFFICIAL_MCP=true
export ANTIGRAVITY_ATTACH_MCP=true # attach mcp-server-datahub when GMS up
export DATAHUB_GMS_URL=http://...  # reachable GMS (not laptop localhost for Cloud Run)
export TOOLS_IS_MUTATION_ENABLED=true  # live tags + save_document
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

After deploy, if GMS runs on GCE quickstart, re-point env (IP can change after VM stop/start):

```bash
IP=$(gcloud compute instances describe datahub-quickstart --zone=us-central1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
gcloud run services update midsphere-api --region=us-central1 \
  --update-env-vars="DATAHUB_GMS_URL=http://${IP}:8080,TOOLS_IS_MUTATION_ENABLED=true,ANTIGRAVITY_ATTACH_MCP=true"
```

VM cost control: `../scripts/gce_datahub_schedule.sh apply`.

Status: **shipping** (Antigravity primary + live MCP when GMS up + deterministic fallback).
