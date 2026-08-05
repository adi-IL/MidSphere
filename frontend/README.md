# frontend/

MidSphere Command Center — React 18 + Vite + TypeScript + Tailwind + React Flow.

**Deploy target:** Vercel project `midsphere` only (from this directory / Actions).

## Layout (shipping)

```
frontend/
├── src/
│   ├── App.tsx                 # Command Center orchestration
│   ├── components/
│   │   ├── layout/             # TopBar, SwarmSidebar, InspectorDrawer, LoadingScreen
│   │   ├── graph/              # LineageCanvas, CustomNode/Edge, TimeTravelBar
│   │   ├── inspect/            # GatePreview, RagChat, DataHubAspectsViewer
│   │   └── score/              # RiskScorecard, RiskRadarChart
│   ├── lib/                    # api.ts, demoJob.ts, types.ts
│   ├── index.css
│   └── main.tsx
├── public/                     # favicon (sphere mark), logo.png (full brand), OG image
├── vercel.json                 # vite + SPA rewrites; git.deploymentEnabled=false
├── package.json
└── vite.config.ts
```


## Design authority

Root [DESIGN.md](../DESIGN.md) — monochrome Command Center, Activity terminal honesty, real MCP names.

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
| `VITE_API_BASE_URL` | Production Cloud Run base (see `.env.production`) |
| empty / local | Vite proxy → `http://127.0.0.1:8000` |

## Features (shipping)

- Multi-scenario offline demos (healthcare / ecommerce / nyctaxi) with honest `sim` telemetry
- Live jobs via `POST /v1/jobs` when API is up
- Trip / Lift wired to backend for API jobs; demo path logs `sim` STATUS only
- Forensic Time Travel scrubber (narrative, not GMS history) — `docs/FORENSIC_TIME_TRAVEL.md`

## Deploy

GitHub Actions `deploy-frontend.yml` on `frontend/**` changes (durable `VERCEL_TOKEN`). See [`.github/DEPLOY.md`](../.github/DEPLOY.md).

Status: **shipping Command Center** (monochrome; multi-scenario; Antigravity-aware labels).
