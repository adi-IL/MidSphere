# frontend/

MidSphere Command Center — React 18 + Vite + TypeScript + Tailwind + React Flow.

**Deploy target:** Vercel project `midsphere` only (from this directory / Actions).

## Layout (shipping)

```
frontend/
├── src/
│   ├── App.tsx                 # Shell: health, scenarios, jobs, stream
│   ├── components/
│   │   ├── layout/             # TopBar, SwarmSidebar (Pipeline), InspectorDrawer (Decision), LoadingScreen
│   │   ├── graph/              # LineageCanvas, CustomNode/Edge, TimeTravelBar (opt-in)
│   │   ├── inspect/            # GatePreview, RagChat, DataHubAspectsViewer
│   │   └── score/              # RiskScorecard, RiskRadarChart
│   ├── lib/                    # api.ts, demoJob.ts, types.ts, status.ts
│   ├── index.css
│   └── main.tsx
├── public/                     # favicon (sphere mark), logo.png (full brand), OG image
├── vercel.json                 # vite + SPA rewrites; git.deploymentEnabled=false
├── package.json
└── vite.config.ts
```

## UI principles (shipping)

- **Minimal monochrome** (Geist / Linear-adjacent): hairline borders, scarce semantic color, no emoji.
- **Progressive disclosure:** Telemetry collapsed by default; Timeline off until toggled; Decision primary tabs = Findings · Gate · Attestation; More = Fix · Aspects · Audit · Raw.
- **Status vocabulary:** Connection Live/Offline · Catalog GMS on/off · Run kind Sample / Agent / Live MCP (`lib/status.ts`).
- **Hero:** selective lineage graph. Side rails are quiet pipeline + decision actions (Trip / Lift sticky).

Root [ARCHITECTURE.md](../ARCHITECTURE.md) and [README.md](../README.md) — telemetry honesty, real MCP names.

## Local

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 (proxies API to :8000)
npm run lint
npm run build
```

| Env | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Production Cloud Run base (baked at build; see `.env.production.example`) |
| empty / local | Vite proxy → `http://127.0.0.1:8000` |

**Production note:** `VITE_API_BASE_URL` must be a real URL, not a Sensitive-env placeholder. Prefer non-sensitive project env + GitHub secret `VITE_API_BASE_URL` so Actions and CLI deploys bake Cloud Run correctly.

## Features (shipping)

- Multi-scenario sample fixtures (healthcare / ecommerce / nyctaxi) with honest simulated telemetry
- Live jobs via `POST /v1/jobs` when API is up
- Trip / Lift wired to backend for API jobs; sample path logs simulated STATUS only
- Optional Timeline scrubber (closed-loop narrative UI, not GMS history)

## Deploy

GitHub Actions `deploy-frontend.yml` on `frontend/**` changes (durable `VERCEL_TOKEN`). See [`.github/DEPLOY.md`](../.github/DEPLOY.md).

Status: **shipping Command Center** — minimal chrome, multi-scenario, honest run kinds.
