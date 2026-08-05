# MidSphere Changelog

Notable shipping changes. Punchlines stay consistent with README / AGENTS:

> **Context entropy** → **circuit-break the context graph** → **selective advisory quarantine** → **fix + MBOM** so the next agent inherits safer context.

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
