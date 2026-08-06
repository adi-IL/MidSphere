# CI/CD — MidSphere monorepo deploys

Automatic deploys when `main` changes under `frontend/` or `backend/`.

| Path change | Workflow | Target |
| --- | --- | --- |
| `frontend/**` | `deploy-frontend.yml` | **Vercel** production (`midsphere`) |
| `backend/**` | `deploy-backend.yml` | **Cloud Run** `midsphere-api` (us-central1) |
| either (PR/push) | `ci.yml` | typecheck + pytest only |
| weekly Mon 00:00 UTC | `vercel-token-keepalive.yml` | `vercel whoami` (token health) |

Manual runs: GitHub → **Actions** → workflow → **Run workflow**.

## Architecture choices (research notes)

1. **Separate workflows + `paths:` filters** — GitHub-native monorepo pattern; skips the unused surface entirely.
2. **Vercel via CLI in Actions** (`pull` → `build --prod` → `deploy --prebuilt`) — [official Vercel + GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel). Build once in Actions; upload the prebuilt artifact (no double build).
3. **Cloud Run via `gcloud run deploy --source`** — matches local operator path. Auth uses **Workload Identity Federation** (OIDC) — no JSON key committed.
4. **Backend deploy needs `id-token: write`** — required for `google-github-actions/auth@v2` WIF.
5. **Tests before backend deploy** — pytest with `ANTIGRAVITY_ENABLED=false` so CI is deterministic.
6. **No Vercel OIDC for deploy auth (yet)** — community feature request only; production still requires a static `VERCEL_TOKEN` secret. Rotate when people leave the team.
7. **Git auto-deploy off for frontend** — `frontend/vercel.json` sets `"git": { "deploymentEnabled": false }` so only Actions deploys production (no dual deploys).

## Durable VERCEL_TOKEN (critical)

### Failure mode we hit

| Symptom | Root cause |
| --- | --- |
| Actions: `Error: The specified token is not valid. Use \`vercel login\`…` | Secret holds a **CLI OAuth / Sign-in-with-Vercel** token (`vca_…`), not an account **Access Token**. |
| Local `auth.json` works for a day, CI dies later | CLI tokens have short `expiresAt` (+ refresh only on the machine that holds `refreshToken`). GitHub Actions never gets that refresh. |
| `vercel tokens add` → `403 Cannot create tokens for this app` | OAuth app sessions cannot mint personal access tokens. Create tokens in the **dashboard**. |

### Correct token (do this once)

1. Open **[vercel.com/account/tokens](https://vercel.com/account/tokens)** while logged in as the account that owns team `midsphere` (personal account menu, not only the team switcher).
2. **Create** → name: `midsphere-github-actions`.
3. **Expiration:** prefer **No Expiration** (or the longest available). Short expirations recreate the outage.
4. **Scope:** Full Account, or the team that owns project `midsphere` (`team_FUcs8fFoJOSKweY8QRIvuKW9`). Optionally scope to project via dashboard / `vercel tokens add --project` when your login can mint tokens.
5. Copy the token **once** (it will not be shown again).
6. Store only in GitHub:

```bash
# Paste when prompted — never echo into shell history or commit
gh secret set VERCEL_TOKEN
```

7. Smoke-test without deploying:

```bash
# After setting the secret, run:
gh workflow run "Vercel Token Keepalive"
# or re-run Deploy Frontend via workflow_dispatch
```

### Never do this

```bash
# WRONG — scrapes short-lived CLI OAuth token (prefix vca_) that dies in hours
TOKEN=$(python3 -c "import json;print(json.load(open('$HOME/.local/share/com.vercel.cli/auth.json'))['token'])")
gh secret set VERCEL_TOKEN --body "$TOKEN"
```

### Keepalive

Workflow `vercel-token-keepalive.yml` runs `vercel whoami` every Monday (and on `workflow_dispatch`). That:

- Bumps **Last Active** (historical Vercel idle-token cleanup)
- Fails the scheduled job if the secret is already dead — so you notice before a product push

### When auth fails in Actions

1. Create a **new** dashboard token (revoke the old one if leaked).
2. `gh secret set VERCEL_TOKEN` with the new value.
3. Re-run **Deploy Frontend (Vercel)** or **Vercel Token Keepalive**.

## Required GitHub secrets

Repo: **Settings → Secrets and variables → Actions**.

### Frontend (Vercel)

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | Durable token from [account tokens](https://vercel.com/account/tokens) — see above |
| `VERCEL_ORG_ID` | From `frontend/.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | From `frontend/.vercel/project.json` → `projectId` |

This project (do not treat as public docs for other forks):

- `orgId`: `team_FUcs8fFoJOSKweY8QRIvuKW9`
- `projectId`: `prj_XzqrwBbifdqT2oQXbkezLMZz0JcB`
- Production alias: https://midsphere.vercel.app

### Backend (GCP)

| Secret | Value |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/1053689941073/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `sentinel-deployer@project-dace7531-ac79-4f81-bd2.iam.gserviceaccount.com` |
| `GCP_PROJECT_ID` (optional) | `project-dace7531-ac79-4f81-bd2` |

WIF provider attribute condition must allow `adi-IL/MidSphere-datahb` (configured for this project).

Deploy SA roles (already on `sentinel-deployer`): `run.admin`, `cloudbuild.builds.editor`, `artifactregistry.admin`, `storage.admin`, `iam.serviceAccountUser`.

### Optional repository variables

| Variable | Default |
| --- | --- |
| `CLOUD_RUN_SERVICE` | `midsphere-api` |
| `CLOUD_RUN_REGION` | `us-central1` |
| `GCP_PROJECT_ID` | `project-dace7531-ac79-4f81-bd2` |

## One-shot secret setup (operator machine)

```bash
# From repo root — requires gh auth. VERCEL_TOKEN must already be a durable dashboard token.
ORG=team_FUcs8fFoJOSKweY8QRIvuKW9
PRJ=prj_XzqrwBbifdqT2oQXbkezLMZz0JcB

# 1) Create durable token in browser: https://vercel.com/account/tokens
# 2) Paste into secret (interactive — preferred):
gh secret set VERCEL_TOKEN

gh secret set VERCEL_ORG_ID --body "$ORG"
gh secret set VERCEL_PROJECT_ID --body "$PRJ"

gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER \
  --body "projects/1053689941073/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider"
gh secret set GCP_SERVICE_ACCOUNT \
  --body "sentinel-deployer@project-dace7531-ac79-4f81-bd2.iam.gserviceaccount.com"
gh secret set GCP_PROJECT_ID --body "project-dace7531-ac79-4f81-bd2"
```

## Local validation before push

```bash
# YAML parse
python3 -c "import yaml,sys; [yaml.safe_load(open(p)) for p in [
  '.github/workflows/ci.yml',
  '.github/workflows/deploy-frontend.yml',
  '.github/workflows/deploy-backend.yml',
  '.github/workflows/vercel-token-keepalive.yml']]"

# Backend tests
cd backend && ANTIGRAVITY_ENABLED=false USE_OFFICIAL_MCP=false python -m pytest tests/ -q

# Frontend
cd frontend && npm run lint && npm run build
```

## Dual-deploy warning (Vercel)

If the Vercel project is **also** connected to GitHub for automatic production deploys, a push may deploy **twice**. This repo hard-disables Git deploys in `frontend/vercel.json`:

```json
"git": { "deploymentEnabled": false }
```

Prefer **Actions only** for monorepo path control. Backend remains Cloud Run / WIF.

## Env files

Cloud Run env comes from `backend/cloudrun-env.yaml` on each deploy. Edit there, then push `backend/**` (or run the backend workflow manually).

## References

- [How can I use GitHub Actions with Vercel?](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)
- [How do I use a Vercel API Access Token?](https://vercel.com/kb/guide/how-do-i-use-a-vercel-api-access-token)
- [Git configuration / deploymentEnabled](https://vercel.com/docs/project-configuration/git-configuration)
- Token keepalive discussion: https://github.com/vercel/vercel/discussions/5112

## DataHub GMS (live demos)

Cloud Run `DATAHUB_GMS_URL` must be a **publicly reachable** GMS (not laptop localhost).
Hackathon path: GCE VM `datahub-quickstart` running official DataHub docker quickstart.

After backend deploy, re-apply env if needed:

```bash
IP=$(gcloud compute instances describe datahub-quickstart --zone=us-central1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
gcloud run services update midsphere-api --region=us-central1 \
  --update-env-vars="DATAHUB_GMS_URL=http://${IP}:8080,TOOLS_IS_MUTATION_ENABLED=true,ANTIGRAVITY_ATTACH_MCP=true"
```

**Cost:** stop the VM when idle. Automate with Compute Engine instance schedules:

```bash
./scripts/gce_datahub_schedule.sh apply
./scripts/gce_datahub_schedule.sh stop-now
```

See [scripts/README.md](../scripts/README.md).
