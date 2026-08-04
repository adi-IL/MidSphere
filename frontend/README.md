# frontend/

MidSphere Command Center — React 18 + Vite + TypeScript.

**Deploy target:** Vercel only (`vercel` / `vercel --prod` from this directory).

## Planned layout

```
frontend/
├── src/
│   ├── app/
│   ├── components/
│   │   ├── layout/      # TopBar, SwarmSidebar, InspectorDrawer
│   │   ├── graph/       # LineageCanvas, nodes, edges
│   │   ├── swarm/       # AgentCard, TelemetryTerminal
│   │   ├── inspect/     # Findings, Gate, Diff, MBOM tabs
│   │   ├── score/       # RiskScorecard
│   │   └── scan/        # TargetPicker
│   ├── lib/             # tokens, API client, artifact types
│   └── pages/           # CommandCenter, JobHistory, Settings, DemoMode
├── package.json         # (to be added)
└── vite.config.ts       # (to be added)
```

## Design authority

Root [DESIGN.md](../DESIGN.md) — Deep Slate palette, three-pane layout, real MCP names in telemetry.

## Local (placeholder)

```bash
# After implementation:
# npm install && npm run dev
# deploy: vercel --prod
```

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
vercel --prod    # project: midsphere (link once)
```

`VITE_API_BASE_URL` optional — empty uses same-origin / Vite proxy to backend.

Status: **Command Center v0** (demo job offline; live API when backend up).
