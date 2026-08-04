# CI/CD — MidSphere monorepo deploys

Automatic deploys when `main` changes under `frontend/` or `backend/`.

| Path change | Workflow | Target |
| --- | --- | --- |
| `frontend/**` | `deploy-frontend.yml` | **Vercel** production (`midsphere`) |
| `backend/**` | `deploy-backend.yml` | **Cloud Run** `midsphere-api` (us-central1) |
| either (PR/push) | `ci.yml` | typecheck + pytest only |

Manual runs: GitHub → **Actions** → workflow → **Run workflow**.

## Architecture choices (research notes)

1. **Separate workflows + `paths:` filters** — GitHub-native monorepo pattern; skips the unused surface entirely (no billable job for the other tree).
2. **Vercel via CLI in Actions** (`pull` → `build --prod` → `deploy --prebuilt`) — official Vercel guide; builds once, deploys the prebuilt artifact. Set secrets so Actions owns production deploys; disable Vercel Git “Production Branch” auto-deploy if you get double deploys.
3. **Cloud Run via `gcloud run deploy --source`** — matches local operator path; Cloud Build builds the `backend/Dockerfile`. Auth uses **Workload Identity Federation** (OIDC) — no JSON key committed.
4. **Backend deploy needs `id-token: write`** — required for `google-github-actions/auth@v2` WIF.
5. **Tests before backend deploy** — pytest with `ANTIGRAVITY_ENABLED=false` so CI is deterministic.

## Required GitHub secrets

Repo: **Settings → Secrets and variables → Actions**.

### Frontend (Vercel)

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) create token |
| `VERCEL_ORG_ID` | From `frontend/.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | From `frontend/.vercel/project.json` → `projectId` |

This project (do not treat as public docs for other forks):

- `orgId`: `team_FUcs8fFoJOSKweY8QRIvuKW9`
- `projectId`: `prj_XzqrwBbifdqT2oQXbkezLMZz0JcB`

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
# From repo root — requires gh + vercel auth
ORG=team_FUcs8fFoJOSKweY8QRIvuKW9
PRJ=prj_XzqrwBbifdqT2oQXbkezLMZz0JcB
# Prefer a dedicated Vercel token; CLI login token works for personal use:
TOKEN=$(python3 -c "import json;print(json.load(open('$HOME/.local/share/com.vercel.cli/auth.json'))['token'])")

gh secret set VERCEL_TOKEN --body "$TOKEN"
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
  '.github/workflows/deploy-backend.yml']]"

# Backend tests
cd backend && ANTIGRAVITY_ENABLED=false USE_OFFICIAL_MCP=false python -m pytest tests/ -q

# Frontend
cd frontend && npm run lint && npm run build
```

## Dual-deploy warning (Vercel)

If the Vercel project is **also** connected to GitHub for automatic production deploys, a push to `frontend/**` may deploy **twice** (Git integration + this Action). Prefer one:

- **Actions only:** Vercel project → Settings → Git → disconnect production auto-deploy, or ignore build step on Vercel Git, **or**
- **Vercel Git only:** disable `deploy-frontend.yml` if you only want Vercel’s native integration (root directory must be `frontend`).

This repo uses Actions for explicit monorepo path control.

## Env files

Cloud Run env comes from `backend/cloudrun-env.yaml` on each deploy. Edit there, then push `backend/**` (or run the backend workflow manually).
