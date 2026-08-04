# backend/

FastAPI + Antigravity multi-agent swarm for MidSphere.

**Deploy target:** GCP Cloud Run only. Do not package `frontend/` here.

## Planned layout

```
backend/
├── app/           # FastAPI entry (main, lifespan, settings)
├── api/           # REST + SSE routes (/v1/jobs, /v1/gate, /v1/health)
├── agents/        # ContextSentinel, CascadeAnalyzer, CircuitBreaker,
│                  # FixArchitect, MBOMEngine
├── gate/          # Consumer Gate (OPEN | BLOCKED | LIFTED)
├── mcp/           # MCP client wrapper (real tool names)
├── models/        # Pydantic job/finding/blast/quarantine artifacts
├── pyproject.toml # (to be added)
└── Dockerfile     # (to be added)
```

## Contracts

See root [AGENTS.md](../AGENTS.md) for tool maps, mutation flags, and job schema.

## Local (placeholder)

```bash
# After implementation:
# uv sync
# export $(grep -v '^#' ../.env | xargs)
# uvicorn app.main:app --reload --port 8000
```

Status: **scaffold only**.
