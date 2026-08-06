# MidSphere Changelog

Notable shipping changes. Punchlines stay consistent with README / AGENTS:

> **Context entropy** → **circuit-break the context graph** → **selective advisory quarantine** → **fix + MBOM** so the next agent inherits safer context.

---

## 2.1 — Honesty + scenario fidelity (post deep audit)

### Frontend

- Inspector **Fix / MBOM** tabs resolve content per scenario (healthcare / ecommerce / nyctaxi), not healthcare-only constants.
- Offline healthcare risk aligned to **61** (matches backend + formula).
- Lineage edge labels scenario-aware (`Quality risk path` / `PII risk path` / `Stale path`); node chrome no longer invents GMS row counts.
- Audit Q&A relabeled **Operator FAQ** (local rules · job-grounded) — not “Grounded AI”.
- Aspects badge: **Job aspect snapshot** (not “GMS GraphQL Sync”).
- `tripJob` timeout 120s; offline trip keeps selective halt (no blanket hop>0 impact).

### Backend

- Shared scenario pack: `agents/scenarios.py` (single source for stage tools + fallback).
- Live MCP `get_lineage` uses **downstream** (`upstream=false`) for blast-radius story; `list_schema_fields` uses job `root_urn`.
- Soft live content annotation (URN count) without replacing selective scenario graph.

### examples/

- Healthcare MBOM + job fixture risk **61**; telemetry sample uses honest `sim` STATUS; README documents risk/path table.

---

## 2.0 — Ergonomics + multi-scenario (`v2-ergonomics-redesign`)

### Command Center

- **Lineage canvas:** custom nodes/edges, pipeline lanes, stress vs calm edge stories.
- **Forensic Time Travel:** five-step scrubber for closed-loop narrative (baseline → audit → cascade → trip → attest). See `docs/FORENSIC_TIME_TRAVEL.md`.
- **Inspector:** Trip / Lift wired to API (offline job-local fallback with honest `sim` STATUS logs).
- **Audit Q&A:** grounded assistant for gate, selective halt, fix, MBOM, MCP honesty.
- **Risk radar** and multi-scenario offline demos (healthcare, ecommerce, NYC taxi).

### Backend

- **Scenario parity:** healthcare / ecommerce / nyctaxi via stage tools + fallback pipeline.
- **Examples:** ecommerce + taxi MBOM/PR artifacts under `examples/`.
- **Job store:** process-local file-backed JSON (`.midsphere/jobs.json`); health reports `storage`.
- **Antigravity:** primary workforce when enabled; **no hardcoded force-fallback**. Optional `ANTIGRAVITY_FORCE_FALLBACK=true` for operators only.
- **GMS probe** on Antigravity job completion for `datahub_reachable`.
- **Telemetry honesty:** offline `sim` STATUS; no fake live TOOL/WRITE; real unprefixed MCP names when live.

### Docs / ops

- Video script: `examples/video/DEMO_VIDEO_SCRIPT.md`
- CI/CD path filters: `.github/DEPLOY.md`
- **Vercel Actions auth:** durable dashboard Access Token (`VERCEL_TOKEN`, no expiration); weekly keepalive workflow; `git.deploymentEnabled=false` so Actions owns production deploys. Do **not** store CLI OAuth (`vca_`) tokens from `auth.json`.

### API completeness (vs early scaffold docs)

- `POST /v1/jobs/{id}/trip` and `GET /v1/gate-default-blocked` are shipping routes (Command Center Trip + convenience gate).

---

## 1.x — Foundation (main lineage before v2)

- Antigravity primary closed loop + deterministic fallback.
- Official MCP client path; Consumer Gate; Cloud Run + Vercel.
- Sentinel-style terminal log; loading screen; MBOM/Fix inspector CTAs.
- Path-filtered GitHub Actions deploy.

---

## Honesty invariants (do not break)

| Mode | What you may claim |
| --- | --- |
| `antigravity_closed_loop` | Agent invoked MidSphere tools (Gemini via Vertex) |
| `demo_closed_loop` | Deterministic stages; `sim` telemetry; no live mutations |
| `live_mcp` | Official MCP tools succeeded against reachable GMS |

Quarantine is **advisory**. Consumer Gate is **MidSphere policy**. MCP does **not** auto-deny all third-party agents.
