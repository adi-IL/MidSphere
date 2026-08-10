#!/usr/bin/env bash
# Automate start/stop of the DataHub quickstart GCE VM (cost control).
#
# Research (GCP): Compute Engine *instance schedules* are the official
# gcloud-native way to start/stop VMs on a cron. True CPU-idle detection
# needs custom agents; schedules are simpler and reliable for hackathon demos.
# Docs: https://cloud.google.com/compute/docs/instances/schedule-instance-start-stop
#
# Defaults (Asia/Kolkata):
#   START  weekdays 09:00
#   STOP   every day 22:00
#
# Usage:
#   ./scripts/gce_datahub_schedule.sh apply    # create policy + attach + IAM
#   ./scripts/gce_datahub_schedule.sh status
#   ./scripts/gce_datahub_schedule.sh stop-now
#   ./scripts/gce_datahub_schedule.sh start-now
#   ./scripts/gce_datahub_schedule.sh remove
#
set -euo pipefail

PROJECT="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-us-central1}"
ZONE="${GCP_ZONE:-us-central1-a}"
INSTANCE="${DATAHUB_GCE_INSTANCE:-datahub-quickstart}"
POLICY="${DATAHUB_GCE_SCHEDULE_POLICY:-datahub-quickstart-schedule}"
TZ="${DATAHUB_GCE_TZ:-Asia/Kolkata}"
# cron: min hour day month weekday
START_CRON="${DATAHUB_GCE_START_CRON:-0 9 * * 1-5}"   # Mon-Fri 09:00
STOP_CRON="${DATAHUB_GCE_STOP_CRON:-0 22 * * *}"      # every day 22:00

die() { echo "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null || die "missing $1"; }

need gcloud
[[ -n "$PROJECT" && "$PROJECT" != "(unset)" ]] || die "set gcloud project"

project_number() {
  gcloud projects describe "$PROJECT" --format='value(projectNumber)'
}

ensure_iam() {
  # Instance schedules run as the Compute Engine system service agent.
  # https://cloud.google.com/compute/docs/instances/schedule-instance-start-stop#before_you_begin
  local num sa
  num="$(project_number)"
  sa="serviceAccount:service-${num}@compute-system.iam.gserviceaccount.com"
  echo "Ensuring instanceAdmin for $sa ..."
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="$sa" \
    --role="roles/compute.instanceAdmin.v1" \
    --condition=None \
    --quiet >/dev/null || true
}

cmd_apply() {
  ensure_iam
  if gcloud compute resource-policies describe "$POLICY" --region="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
    echo "Policy $POLICY already exists (region $REGION)."
  else
    echo "Creating instance schedule $POLICY ..."
    gcloud compute resource-policies create instance-schedule "$POLICY" \
      --project="$PROJECT" \
      --region="$REGION" \
      --timezone="$TZ" \
      --vm-start-schedule="$START_CRON" \
      --vm-stop-schedule="$STOP_CRON" \
      --description="MidSphere DataHub quickstart cost control (start weekdays, stop nightly)"
  fi

  # Attach (idempotent: remove then add if already attached)
  echo "Attaching $POLICY to $INSTANCE ($ZONE) ..."
  gcloud compute instances add-resource-policies "$INSTANCE" \
    --project="$PROJECT" \
    --zone="$ZONE" \
    --resource-policies="$POLICY" \
    --quiet 2>/dev/null \
    || {
      echo "Re-attach after remove (policy may already be linked) ..."
      gcloud compute instances remove-resource-policies "$INSTANCE" \
        --project="$PROJECT" --zone="$ZONE" --resource-policies="$POLICY" --quiet || true
      gcloud compute instances add-resource-policies "$INSTANCE" \
        --project="$PROJECT" --zone="$ZONE" --resource-policies="$POLICY" --quiet
    }

  echo
  echo "Schedule applied:"
  echo "  timezone: $TZ"
  echo "  start:    $START_CRON  (weekdays 09:00 by default)"
  echo "  stop:     $STOP_CRON   (daily 22:00 by default)"
  echo "  instance: $INSTANCE"
  echo
  echo "After stop, Cloud Run health will show datahub_reachable=false until you start the VM"
  echo "and re-point DATAHUB_GMS_URL if the external IP changed."
  cmd_status
}

cmd_status() {
  echo "=== Instance ==="
  gcloud compute instances describe "$INSTANCE" --project="$PROJECT" --zone="$ZONE" \
    --format='table(name,status,networkInterfaces[0].accessConfigs[0].natIP,resourcePolicies.list())' 2>/dev/null \
    || echo "(instance not found)"
  echo
  echo "=== Schedule policy ==="
  gcloud compute resource-policies describe "$POLICY" --project="$PROJECT" --region="$REGION" \
    --format=yaml 2>/dev/null | head -40 || echo "(policy not found)"
}

cmd_stop_now() {
  echo "Stopping $INSTANCE now ..."
  gcloud compute instances stop "$INSTANCE" --project="$PROJECT" --zone="$ZONE" --quiet
  cmd_status
}

cmd_repoint_cloudrun() {
  local ip="$1"
  local service="${CLOUD_RUN_SERVICE:-midsphere-api}"
  local run_region="${CLOUD_RUN_REGION:-us-central1}"
  [[ -n "$ip" ]] || die "no external IP to re-point Cloud Run"
  echo "Re-pointing Cloud Run ${service} → http://${ip}:8080 ..."
  gcloud run services update "$service" \
    --project="$PROJECT" \
    --region="$run_region" \
    --update-env-vars="DATAHUB_GMS_URL=http://${ip}:8080,TOOLS_IS_MUTATION_ENABLED=true,USE_OFFICIAL_MCP=true,ANTIGRAVITY_ATTACH_MCP=true" \
    --quiet
  echo "Cloud Run env updated. Frontend chip uses GET /v1/health → datahub_reachable."
}

cmd_wait_gms() {
  local ip="$1"
  local max="${2:-40}"
  local i code
  echo "Waiting for DataHub GMS at http://${ip}:8080/health (cold start can take 5-15 min)..."
  for i in $(seq 1 "$max"); do
    code="$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "http://${ip}:8080/health" 2>/dev/null || echo 000)"
    echo "  [$i/$max] http=$code"
    if [ "$code" = "200" ]; then
      echo "GMS is up."
      return 0
    fi
    sleep 15
  done
  echo "WARN: GMS not healthy yet. Check: gcloud compute ssh $INSTANCE --zone=$ZONE -- 'sudo docker ps'"
  return 1
}

cmd_start_now() {
  echo "Starting $INSTANCE now ..."
  gcloud compute instances start "$INSTANCE" --project="$PROJECT" --zone="$ZONE" --quiet
  sleep 8
  local ip
  ip="$(gcloud compute instances describe "$INSTANCE" --project="$PROJECT" --zone="$ZONE" \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"
  echo "External IP: $ip  (IP often changes after stop/start)"
  # Containers may stay stopped after VM resume; start DataHub stack
  echo "Starting DataHub docker containers on VM (if present) ..."
  gcloud compute ssh "$INSTANCE" --project="$PROJECT" --zone="$ZONE" --command='
    sudo systemctl start docker 2>/dev/null || true
    for c in datahub-mysql-1 datahub-opensearch-1 datahub-kafka-broker-1; do
      sudo docker start "$c" 2>/dev/null || true
    done
    sleep 5
    sudo docker start datahub-datahub-gms-quickstart-1 datahub-frontend-quickstart-1 datahub-datahub-actions-quickstart-1 2>/dev/null || true
    sudo docker ps --format "table {{.Names}}\t{{.Status}}" | head -15
  ' 2>/dev/null || echo "WARN: could not SSH to start containers; start them manually if GMS stays down"
  # Always re-point Cloud Run (IP change + prior deploys may reset to localhost)
  cmd_repoint_cloudrun "$ip"
  cmd_wait_gms "$ip" 40 || true
  echo
  echo "Verify API:"
  echo "  curl -sS https://midsphere-api-1053689941073.us-central1.run.app/v1/health | jq .datahub_reachable"
  echo "Then hard-refresh https://midsphere.vercel.app (status should show Live and GMS)."
  cmd_status
}

cmd_remove() {
  echo "Detaching schedule from $INSTANCE ..."
  gcloud compute instances remove-resource-policies "$INSTANCE" \
    --project="$PROJECT" --zone="$ZONE" --resource-policies="$POLICY" --quiet || true
  echo "Deleting policy $POLICY ..."
  gcloud compute resource-policies delete "$POLICY" \
    --project="$PROJECT" --region="$REGION" --quiet || true
  echo "Removed."
}

cmd_wake_fast() {
  echo "Waking $INSTANCE now (fast non-blocking mode)..."
  gcloud compute instances start "$INSTANCE" --project="$PROJECT" --zone="$ZONE" --quiet || true
  cmd_status
}

usage() {
  sed -n '1,25p' "$0"
}

case "${1:-}" in
  apply) apply_cmd=cmd_apply; cmd_apply ;;
  status) cmd_status ;;
  stop-now|stop) cmd_stop_now ;;
  start-now|start) cmd_start_now ;;
  wake-fast|start-fast) cmd_wake_fast ;;
  remove) cmd_remove ;;
  *) usage; exit 1 ;;
esac

