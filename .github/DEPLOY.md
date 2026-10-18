# CI/CD: MidSphere monorepo deploys

Automatic deploys when `main` changes under `frontend/` or `backend/`.

| Path change | Workflow | Target |
| --- | --- | --- |
| `frontend/**` | `deploy-frontend.yml` | Vercel production (`midsphere`) |
| `backend/**` | `deploy-backend.yml` | Cloud Run `midsphere-api` (us-central1) |
| either (PR/push) | `ci.yml` | typecheck and pytest only |
| weekly Mon 00:00 UTC | `vercel-token-keepalive.yml` | `vercel whoami` (token health) |

Manual runs: GitHub Actions, select workflow, **Run workflow**.

## Design choices

1. Separate workflows with `paths:` filters so only the changed surface deploys.
2. Vercel via CLI in Actions (`pull` then `build --prod` then `deploy --prebuilt`). See [Vercel + GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel).
3. Cloud Run via `gcloud run deploy --source` with Workload Identity Federation (OIDC). No JSON service-account key in git.
4. Backend deploy requires `id-token: write` for `google-github-actions/auth@v3`.
5. Backend tests run with `ANTIGRAVITY_ENABLED=false` for deterministic CI.
6. Production still needs a static `VERCEL_TOKEN` secret (no Vercel OIDC deploy path in this repo).
7. Frontend `vercel.json` sets `"git": { "deploymentEnabled": false }` so only Actions deploys production.

## Durable VERCEL_TOKEN

### Failure mode

| Symptom | Root cause |
| --- | --- |
| Actions: token not valid | Secret holds a short-lived CLI OAuth token (`vca_...`), not an account access token |
| Local CLI works, CI fails later | CLI OAuth tokens expire; Actions cannot refresh them |
| `vercel tokens add` returns 403 | OAuth app sessions cannot mint personal access tokens; create tokens in the dashboard |

### Create a durable token (once)

1. Open [vercel.com/account/tokens](https://vercel.com/account/tokens) as the account that owns project `midsphere`.
2. Create token named `midsphere-github-actions`.
3. Prefer **No Expiration** (or the longest available period).
4. Scope: Full Account, or the team that owns `midsphere` (`team_FUcs8fFoJOSKweY8QRIvuKW9`).
5. Copy the token once. Store only in GitHub:

```bash
# Interactive paste preferred; do not echo into shell history or commit
gh secret set VERCEL_TOKEN
```

6. Smoke test:

```bash
gh workflow run "Vercel Token Keepalive"
```

### Do not do this

```bash
# Wrong: scrapes short-lived CLI OAuth token (prefix vca_)
TOKEN=$(python3 -c "import json;print(json.load(open('$HOME/.local/share/com.vercel.cli/auth.json'))['token'])")
gh secret set VERCEL_TOKEN --body "$TOKEN"
```

### Keepalive

Workflow `vercel-token-keepalive.yml` runs `vercel whoami` on a schedule and on `workflow_dispatch`. It bumps last-active time and fails if the secret is already invalid.

### When auth fails in Actions

1. Create a new dashboard token (revoke the old one if leaked).
2. `gh secret set VERCEL_TOKEN` with the new value.
3. Re-run **Deploy Frontend (Vercel)** or **Vercel Token Keepalive**.

## Required GitHub secrets

Repository: **Settings → Secrets and variables → Actions**.

### Frontend (Vercel)

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | Durable token from [account tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | From `frontend/.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | From `frontend/.vercel/project.json` → `projectId` |
| `VITE_API_BASE_URL` | Cloud Run API base (recommended so builds never bake empty/wrong base) |

This project:

- `orgId`: `team_FUcs8fFoJOSKweY8QRIvuKW9`
- `projectId`: `prj_XzqrwBbifdqT2oQXbkezLMZz0JcB`
- Production alias: https://midsphere.vercel.app

### Backend (GCP)

| Secret | Value |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/1053689941073/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `sentinel-deployer@project-dace7531-ac79-4f81-bd2.iam.gserviceaccount.com` |
| `GCP_PROJECT_ID` (optional) | `project-dace7531-ac79-4f81-bd2` |

WIF provider attribute condition must allow `adi-IL/MidSphere` (legacy `adi-IL/MidSphere-datahb` may remain during redirect).

Deploy service account roles already in use: `run.admin`, `cloudbuild.builds.editor`, `artifactregistry.admin`, `storage.admin`, `iam.serviceAccountUser`.

**GMS URL:** `backend/cloudrun-env.yaml` must **not** set `DATAHUB_GMS_URL` to localhost. Deploy workflow captures any pre-deploy non-localhost GMS and restores it after `--env-vars-file` (which replaces the env map). Point GMS with `scripts/gce_datahub_schedule.sh start-now` when the quickstart IP changes.

**Critical:** after a repo rename, also grant `roles/iam.workloadIdentityUser` on the deploy SA to the **new** principal, not only update the provider condition:

```bash
# Provider admission (pool entry) alone is not enough.
# Missing this binding surfaces as: Permission 'iam.serviceAccounts.getAccessToken' denied
gcloud iam service-accounts add-iam-policy-binding \
  sentinel-deployer@project-dace7531-ac79-4f81-bd2.iam.gserviceaccount.com \
  --project=project-dace7531-ac79-4f81-bd2 \
  --role=roles/iam.workloadIdentityUser \
  --member='principalSet://iam.googleapis.com/projects/1053689941073/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/adi-IL/MidSphere'
```

Symptom of a missing SA binding: Authenticate WIF succeeds, then Setup gcloud fails on `getAccessToken`.

### Optional repository variables

| Variable | Default |
| --- | --- |
| `CLOUD_RUN_SERVICE` | `midsphere-api` |
| `CLOUD_RUN_REGION` | `us-central1` |
| `GCP_PROJECT_ID` | `project-dace7531-ac79-4f81-bd2` |

## One-shot secret setup (operator machine)

```bash
# From repo root; requires gh auth. VERCEL_TOKEN must be a durable dashboard token.
ORG=team_FUcs8fFoJOSKweY8QRIvuKW9
PRJ=prj_XzqrwBbifdqT2oQXbkezLMZz0JcB
printf '%s' "$ORG" | gh secret set VERCEL_ORG_ID
printf '%s' "$PRJ" | gh secret set VERCEL_PROJECT_ID
printf '%s' 'https://midsphere-api-1053689941073.us-central1.run.app' | gh secret set VITE_API_BASE_URL
# then: gh secret set VERCEL_TOKEN
```

After Cloud Run GMS URL changes, re-point with `scripts/gce_datahub_schedule.sh start-now` or `gcloud run services update` as in `scripts/README.md`.
