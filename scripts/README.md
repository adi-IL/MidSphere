# scripts/

Operator helpers for DataHub + MidSphere.

| Script | Purpose |
| --- | --- |
| `gce_datahub_schedule.sh` | **Cost control:** attach Compute Engine instance schedule to auto start/stop the DataHub quickstart VM |
| `bootstrap_midsphere_metadata.py` | Checklist for tags/properties (create via UI/GraphQL if not present) |
| `load_healthcare.sh` | Ingest healthcare sample into a GMS (needs local static-assets clone) |
| `check_env.sh` | Soft check of GMS env vars |

## Live GMS for Cloud Run (gcloud path)

Cloud Run **cannot** use `http://localhost:8080` on your laptop. Shipping approach:

1. GCE VM runs official `datahub docker quickstart` (same as local quickstart).  
2. Firewall allows TCP **8080** (GMS) and **9002** (UI).  
3. Cloud Run env:  
   `DATAHUB_GMS_URL=http://EXTERNAL_IP:8080`  
   `TOOLS_IS_MUTATION_ENABLED=true`  
   `ANTIGRAVITY_ATTACH_MCP=true`  
4. Tags once: `QUARANTINED`, `CIRCUIT_BROKEN`, `MIDSPHERE_AUDIT`, `PII_LEAK`, `PIPELINE_LAG`.

After every backend deploy, re-check GMS URL if the workflow reset env vars.

### Auto stop / start (save money)

Research: GCP’s built-in **instance schedules** (resource policies) start/stop VMs on a cron without custom idle agents. See [Schedule VM start/stop](https://docs.cloud.google.com/compute/docs/instances/schedule-instance-start-stop).

```bash
# Attach schedule (default Asia/Kolkata: start Mon–Fri 09:00, stop daily 22:00)
./scripts/gce_datahub_schedule.sh apply

./scripts/gce_datahub_schedule.sh status
./scripts/gce_datahub_schedule.sh stop-now   # stop immediately
./scripts/gce_datahub_schedule.sh start-now  # start VM, re-point Cloud Run DATAHUB_GMS_URL, wait for GMS
./scripts/gce_datahub_schedule.sh remove     # detach + delete policy
```

Override cron / zone with env vars: `DATAHUB_GCE_START_CRON`, `DATAHUB_GCE_STOP_CRON`, `DATAHUB_GCE_TZ`, `GCP_ZONE`.

**Stopped VM:** Cloud Run health shows `datahub_reachable=false` until you start the VM again. External IP can change after stop/start — re-point Cloud Run:

```bash
IP=$(gcloud compute instances describe datahub-quickstart --zone=us-central1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
gcloud run services update midsphere-api --region=us-central1 \
  --update-env-vars="DATAHUB_GMS_URL=http://${IP}:8080"
```

Disk charges continue while stopped; compute charges stop.

## Samples (healthcare / ecommerce / nyc-taxi)

MidSphere demos three packs via `backend/agents/scenarios.py` (always).  
Optional live catalog population on the GCE quickstart:

- `datahub datapack load showcase-ecommerce`  
- Healthcare / NYC taxi: ingest scripts under [static-assets datasets](https://github.com/datahub-project/static-assets) (clone under `resource/` locally; not shipped in the public tree)

`load_healthcare.sh` expects:

`resource/repositories/static-assets/datasets/healthcare/`

Do **not** use `datahub datapack load healthcare` — that is not the official datapack name for that sample.

## Tags for live mutations

Create (once) if missing:

- Tags: `QUARANTINED`, `CIRCUIT_BROKEN`, `MIDSPHERE_AUDIT`, `PII_LEAK`, `PIPELINE_LAG`  
- Optional structured property: `midsphere.gate_status`

```bash
python scripts/bootstrap_midsphere_metadata.py   # checklist
# or GraphQL createTag against GMS /api/graphql
```

See [ARCHITECTURE.md](../ARCHITECTURE.md).
