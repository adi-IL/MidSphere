# backend/

FastAPI closed-loop API for MidSphere.

**Deploy target:** GCP Cloud Run service `midsphere-api` only. Do not package `frontend/` here.

## Layout

```
backend/
├── app/              # FastAPI entry (main, settings)
├── api/              # REST /v1/* (jobs, gate, health, trip, lift)
├── agents/           # pipeline, antigravity_runner, stage_tools, scenarios
├── gate/             # Consumer Gate (OPEN | BLOCKED | LIFTED)
├── midsphere_mcp/    # GMS probe and official mcp-server-datahub client
├── models/           # Pydantic job artifacts
├── tests/            # pytest (simulated telemetry honesty and gate)
├── requirements.txt
├── Dockerfile
└── cloudrun-env.yaml
```

## Contracts

Root [ARCHITECTURE.md](../ARCHITECTURE.md): primary workforce is the **Google Antigravity SDK** (Python package `google-antigravity`). Official DataHub MCP attaches when GMS is reachable. Stage tools may call live `get_lineage`, `add_tags`, and `save_document` when mutations are enabled. **Lift** calls live `remove_tags` the same way when GMS + mutations are on. Scenario packs: healthcare, ecommerce, nyctaxi (`agents/scenarios.py`). Manual smoke: [docs/MANUAL_TEST.md](../docs/MANUAL_TEST.md).

## Local

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTIGRAVITY_ENABLED=true
export USE_OFFICIAL_MCP=true
export ANTIGRAVITY_ATTACH_MCP=true
export DATAHUB_GMS_URL=http://...   # reachable GMS (not laptop localhost for Cloud Run)
export TOOLS_IS_MUTATION_ENABLED=true
# Vertex: GOOGLE_CLOUD_PROJECT and ADC
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

Deterministic tests:

```bash
ANTIGRAVITY_ENABLED=false USE_OFFICIAL_MCP=false python -m pytest tests/ -q
```

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/v1/health` | `official_mcp.probed` false by default (not a failure) |
| POST | `/v1/jobs` | Closed loop |
| GET | `/v1/jobs/latest` | **404** when empty (no auto-pipeline) |
| GET | `/v1/jobs/{id}` | |
| POST | `/v1/jobs/{id}/lift` | Job gate + live `remove_tags` when GMS + mutations |
| POST | `/v1/jobs/{id}/trip` | Re-run closed loop with auto-trip |
| GET | `/v1/gate/{urn}` | Against latest job quarantine set |
| GET | `/v1/gate-default-blocked` | Healthcare `mart_billing` convenience only |

## Deploy

Path-filtered GitHub Actions to Cloud Run via Workload Identity Federation. See [`.github/DEPLOY.md`](../.github/DEPLOY.md).

After deploy, if GMS runs on GCE quickstart, re-point env when the external IP changes:

```bash
IP=$(gcloud compute instances describe datahub-quickstart --zone=us-central1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
gcloud run services update midsphere-api --region=us-central1 \
  --update-env-vars="DATAHUB_GMS_URL=http://${IP}:8080,TOOLS_IS_MUTATION_ENABLED=true,ANTIGRAVITY_ATTACH_MCP=true"
```

Or use `../scripts/gce_datahub_schedule.sh start-now`, which starts the VM and re-points Cloud Run.
