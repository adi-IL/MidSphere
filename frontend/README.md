# frontend/

MidSphere Command Center: React 18, Vite, TypeScript, Tailwind, React Flow.

**Deploy target:** Vercel project `midsphere` only (this directory / GitHub Actions).

## Layout

```
frontend/
├── src/
│   ├── App.tsx                 # Health, scenarios, jobs, stream
│   ├── components/
│   │   ├── layout/             # TopBar, Pipeline (SwarmSidebar), Decision (InspectorDrawer), LoadingScreen
│   │   ├── graph/              # LineageCanvas, CustomNode/Edge, TimeTravelBar (opt-in)
│   │   ├── inspect/            # GatePreview, RagChat, DataHubAspectsViewer
│   │   └── score/              # RiskScorecard, RiskRadarChart
│   ├── lib/                    # api.ts, demoJob.ts, types.ts, status.ts
│   ├── index.css
│   └── main.tsx
├── public/
├── vercel.json                 # SPA rewrites; git.deploymentEnabled=false
├── package.json
└── vite.config.ts
```

## UI principles

- Minimal monochrome chrome. No emoji in product UI.
- Progressive disclosure: Telemetry collapsed by default; Timeline off until toggled; Decision primary tabs are Findings, Gate, Attestation.
- Status vocabulary in `lib/status.ts`: connection Live/Offline, catalog GMS on/off, run kind Sample / Agent / Live MCP.
- Graph is the primary surface. Side rails hold pipeline stages and decision actions (Trip / Lift).

See root [ARCHITECTURE.md](../ARCHITECTURE.md) and [README.md](../README.md).

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
| `VITE_API_BASE_URL` | Cloud Run base URL baked at production build |
| empty (local) | Vite proxy to `http://127.0.0.1:8000` |

Production builds require a real Cloud Run URL in `VITE_API_BASE_URL` (project env and/or GitHub secret). A Sensitive-env redaction placeholder must not be baked into the client bundle.

## Features

- Three sample scenario fixtures (healthcare, ecommerce, nyctaxi) with simulated telemetry when offline
- Live jobs via `POST /v1/jobs` when the API is up
- Trip / Lift call backend for API jobs; sample path logs simulated STATUS only
- Optional Timeline scrubber (narrative only, not GMS history)
- Top bar GitHub control opens the public source: https://github.com/adi-IL/MidSphere

## Deploy

GitHub Actions `deploy-frontend.yml` on `frontend/**` changes. Requires durable `VERCEL_TOKEN`. See [`.github/DEPLOY.md`](../.github/DEPLOY.md).
