# scripts/

Operator helpers for DataHub and MidSphere.

| Script | Purpose |
| --- | --- |
| `gce_datahub_schedule.sh` | Attach Compute Engine instance schedule; start/stop DataHub quickstart VM |
| `bootstrap_midsphere_metadata.py` | Checklist for tags and properties (create via UI or GraphQL if missing) |
| `load_healthcare.sh` | Ingest healthcare sample into a GMS (requires local static-assets clone) |
| `check_env.sh` | Soft check of GMS environment variables |

## Live GMS for Cloud Run

Cloud Run cannot use `http://localhost:8080` on a laptop. Shipping approach:

1. GCE VM runs official `datahub docker quickstart`.  
2. Firewall allows TCP **8080** (GMS) and **9002** (UI) if needed.  
3. Cloud Run environment:
   - `DATAHUB_GMS_URL=http://EXTERNAL_IP:8080`
   - `TOOLS_IS_MUTATION_ENABLED=true`
   - `ANTIGRAVITY_ATTACH_MCP=true`
4. Create tags once if missing: `QUARANTINED`, `CIRCUIT_BROKEN`, `MIDSPHERE_AUDIT`, `PII_LEAK`, `PIPELINE_LAG`.

After backend deploys, re-check `DATAHUB_GMS_URL` if the workflow reset environment variables.

### Auto stop and start

GCP instance schedules start and stop VMs on a cron without custom idle agents. See [Schedule a VM instance to start and stop](https://cloud.google.com/compute/docs/instances/schedule-instance-start-stop).

```bash
./scripts/gce_datahub_schedule.sh apply
./scripts/gce_datahub_schedule.sh status
./scripts/gce_datahub_schedule.sh stop-now
./scripts/gce_datahub_schedule.sh start-now   # start VM, re-point Cloud Run, wait for GMS
./scripts/gce_datahub_schedule.sh remove
```

Override with env vars: `DATAHUB_GCE_START_CRON`, `DATAHUB_GCE_STOP_CRON`, `DATAHUB_GCE_TZ`, `GCP_ZONE`.

While the VM is stopped, Cloud Run health reports `datahub_reachable=false`. External IP may change after stop/start. `start-now` re-points Cloud Run; manual re-point:

```bash
IP=$(gcloud compute instances describe datahub-quickstart --zone=us-central1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
gcloud run services update midsphere-api --region=us-central1 \
  --update-env-vars="DATAHUB_GMS_URL=http://${IP}:8080"
```

Disk charges continue while stopped; compute charges stop.

## Samples (healthcare / ecommerce / nyc-taxi)

MidSphere always uses three packs from `backend/agents/scenarios.py`. Optional live catalog population on the GCE quickstart:

- `datahub datapack load showcase-ecommerce`
- Healthcare and NYC taxi: ingest scripts under [static-assets datasets](https://github.com/datahub-project/static-assets) (clone under `resource/` locally; not shipped in the public tree)

`load_healthcare.sh` expects:

`resource/repositories/static-assets/datasets/healthcare/`

Do not use `datahub datapack load healthcare`. That is not the official datapack name for that sample.

## Tags for live mutations

Create once if missing:

- Tags: `QUARANTINED`, `CIRCUIT_BROKEN`, `MIDSPHERE_AUDIT`, `PII_LEAK`, `PIPELINE_LAG`
- Optional structured property: `midsphere.gate_status`

```bash
python scripts/bootstrap_midsphere_metadata.py   # checklist only; does not create tags
# or GraphQL createTag against GMS /api/graphql
```

See [ARCHITECTURE.md](../ARCHITECTURE.md).
