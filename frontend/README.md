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
- Status vocabulary: TopBar **API · Job** / **API · Sample** / Offline (connection + data source), catalog GMS on/off, run kind Sample / Agent / Live MCP (`lib/status.ts`).
- Graph is the primary surface. Side rails hold pipeline stages and decision actions (Trip / Lift).
- Scenario roots in `lib/types.ts` match backend packs: `raw_patients`, `raw_customers`, `raw_yellow_trips`.

See root [ARCHITECTURE.md](../ARCHITECTURE.md), [README.md](../README.md), and [docs/MANUAL_TEST.md](../docs/MANUAL_TEST.md).

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
- Live jobs via `POST /v1/jobs` when the API is up; empty `GET /v1/jobs/latest` is 404 (sample boot is fine)
- Trip / Lift call backend for API jobs (`trip` re-runs closed loop; `lift` may live-`remove_tags` when GMS + mutations)
- Sample path (no API job) logs simulated STATUS only; failed API Trip/Lift logs honesty then local sim
- Optional Timeline scrubber (narrative only, not GMS history)
- Top bar GitHub control opens the public source: https://github.com/adi-IL/MidSphere

## Deploy

GitHub Actions `deploy-frontend.yml` on `frontend/**` changes. Requires durable `VERCEL_TOKEN`. See [`.github/DEPLOY.md`](../.github/DEPLOY.md).
