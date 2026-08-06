# MidSphere — Deep line-by-line audit (full product surface)

**Date:** 2026-08-06  
**Method:** Every tracked product source file under git (113 files). Full read of all Python (~2.5k LOC), TypeScript/TSX (~3.5k LOC), skills, examples, CI/deploy, scripts. Live API re-probed.  
**Scope exclude:** `resource/` (gitignored), `node_modules/`, binary PNGs (presence only).  
**Companion:** Prior high-level audit in `issues/hackathon-full-project-audit.md`.

---

## My honest view after reading everything

You built a **real product shell** with a **real agent harness** (Antigravity + Gemini on Vertex actually runs on Cloud Run), a **correct mental model of DataHub MCP**, and an **excellent honesty layer in docs/tests**. That is rarer than most hackathon chat-wrappers.

But after reading **every stage body, every UI panel, every example, every env flag**, the core truth is:

> **MidSphere is a beautifully staged, multi-scenario demo engine with an LLM that presses five buttons in order. Those buttons return canned scenario tables. DataHub is optional garnish on the fallback path, and production Cloud Run currently has no reachable GMS.**

That does **not** make it a bad submission. It **does** mean judges who dig will score **Use of DataHub** and **Technical Execution** on “how deep is the intelligence,” not on “how pretty is the Command Center.”

If you ship video + keep honesty in the voiceover, this is a **solid Challenge Winner contender**. Grand Prize needs live graph I/O driving decisions, not decorating them.

---

## What I actually read (inventory)

| Area | Files / LOC | Verdict in one line |
| --- | --- | --- |
| `backend/agents/*` | pipeline 726, stage_tools 396, antigravity 246 | Agent real; tool bodies = scenario switch |
| `backend/midsphere_mcp/*` | official 177, client 133 | Real MCP client; unused by primary path |
| `backend/api/routes.py` | 183 | Clean API; process-local store; expensive latest/gate |
| `backend/gate/service.py` | 65 | Correct policy; slightly messy branches |
| `backend/models/artifacts.py` | 91 | Honest JobArtifact contract |
| `frontend/src/*` | ~3.5k | Strong UX; several honesty / fidelity bugs |
| `skills/*` | 2 skill packs | Good drafts; not upstream |
| `examples/*` | diffs, MBOMs, video script | Video **script only**, no footage |
| CI/deploy | 4 workflows + Dockerfile | Solid isolation; prod GMS localhost |

---

## Architecture truth table (code vs claim)

| Claim | Code reality |
| --- | --- |
| Antigravity primary workforce | **True** — `run_closed_loop` → `run_job_with_antigravity` first; prod jobs show `model=gemini-3.6-flash` tool_calls |
| Five specialized agents | **Orchestration labels only** — one Agent, five Python callables; no multi-agent messaging |
| Tools do “real MidSphere work” | **Work is scenario lookup** — `_get_scenario_spec(root_urn)` is the entire brain |
| Official DataHub MCP | **Implemented** in `official.py`; **not used** on Antigravity primary tool path; prod `ANTIGRAVITY_ATTACH_MCP=false` |
| Live mutations | **Only fallback path** + `TOOLS_IS_MUTATION_ENABLED` + reachable GMS; stage_tools always `mutations_applied=False` |
| Consumer Gate | **Job-local policy** on latest job’s quarantine set — correctly documented |
| FixArchitect generates code | **Returns path string** to pre-baked example diff |
| MBOM via save_document | **Fallback can try**; primary only sets local path/urn |
| Forensic Time Travel | **UI scrubber** of hop masks — not GMS history (docs mostly honest) |
| Audit Q&A / “Grounded AI” | **Keyword if/else** on client — not LLM, not RAG, not MCP |
| Aspects “GMS GraphQL Sync” | **Static demo JSON** in `demoJob.ts` — backend JobArtifact has no `aspects` field |

---

## File-by-file findings (backend)

### `agents/stage_tools.py` — the product core

- `_get_scenario_spec`: if/elif on `"ecommerce"|"customers"`, `"nyctaxi"|"trips"|"taxi"|"yellow"`, else healthcare.
- Every tool (`audit`, `cascade`, `breaker`, `fix`, `mbom`) **re-calls** the same spec. No shared analysis object from prior tool output (cascade ignores audit findings).
- `midsphere_circuit_breaker_trip`: **hardcodes** `mutations_applied = False`; WRITE event is **job-local only**.
- `midsphere_fix_architect` / `mbom_engine`: **no generation**, only paths.
- `ensure_complete_fallback` in `to_job()`: if Gemini never calls tools, job still succeeds with full stages. **Agent is not required for success.**
- Risk scores hardcoded (61 / 88 / 65), not `compute_risk_score()` (though healthcare 61 matches formula for HIGH+3 downstream+PII+prod).

**Severity:** P0 for “agents that do real work” depth.

### `agents/antigravity_runner.py`

- SYSTEM prompt forces tool order 1–5 — agent is a **sequencer**, not a planner over catalog state.
- MCP attach gated by `uvx` + `ANTIGRAVITY_ATTACH_MCP` (default true in code, **false in `cloudrun-env.yaml`**).
- Prod evidence: `mcp=False` in job events.
- On success returns even if agent only partially called tools (builder fills rest).
- Model fan-out loop: tries models with MCP then without — good resilience.
- `enrich_job_with_antigravity` can re-run entire primary job — dead-ish legacy path.

### `agents/pipeline.py` — fallback

**Good:**

- Telemetry guards: forbidden `datahub_*` / `create_incident`.
- `sim` STATUS for offline (not fake TOOL).
- Live path: `get_lineage`, `list_schema_fields`, `search`, optional `add_tags`, optional `save_document`.
- `execution_mode=live_mcp` only if probe + live_tool_calls > 0.

**Bugs / design holes:**

| Line area | Issue |
| --- | --- |
| `get_lineage` args | `"upstream": True` for a **downstream blast-radius** story |
| `list_schema_fields` | Always `URN_RAW` (healthcare) even for ecommerce/taxi jobs |
| Live MCP results | **Never parsed** into findings/nodes — only increments `live_tool_calls` |
| Scenario block | Full duplicate of stage_tools tables (drift risk) |
| Cascade sim | Always mentions healthcare `URN_STAGING` even for other scenarios |
| `lift_quarantine` | **Never** calls live `remove_tags`; always sim STATUS |
| `compute_risk_score` | Defined + tested but **unused** by scenario paths |
| Duplicate URNs | Also in `constants.py` — three places |

### `midsphere_mcp/official.py`

- Solid stdio client; refuses non-allowlisted tools.
- Broader tool set than `client.REAL_MCP_TOOLS` (terms/owners/domains) — fine.
- Spawns new `uvx` process **per** `call_official_mcp` — slow/heavy if used heavily.
- `result.ok = True` if session listed tools even when individual calls fail — callers must check per-call.

### `midsphere_mcp/client.py`

- HTTP probe to `/health|/config|/` — **not MCP**, correctly documented.
- `try_graphql` exists but **never used** by pipeline.
- `record_tool` forbids invented names — good.

### `api/routes.py`

| Endpoint | Behavior | Risk |
| --- | --- | --- |
| `GET /health` | Honest flags; official MCP probe **off** unless `HEALTH_PROBE_OFFICIAL_MCP` | Prod shows tools=0 always |
| `POST /jobs` | Full closed loop | Can be 20–90s; sync request |
| `GET /jobs/latest` | **Runs new job if empty** | Surprise cost / latency on cold |
| `GET /gate-default-blocked` | May run full job if no latest | Same |
| `POST .../trip` | Full re-run auto_trip | Frontend timeout 12s vs job 20–90s **will fail** |
| `POST .../lift` | Job-local only | OK if honest |
| Storage | `_JOBS` + `.midsphere/jobs.json` | Multi-instance Cloud Run **split brain** |

### `gate/service.py`

- Policy string is correct (advisory, not platform denial).
- Branch nesting for LIFTED/OPEN is redundant; default OPEN is safe.
- Gate only sees **latest job in process memory**, not DataHub tags.

### `app/settings.py` + `cloudrun-env.yaml`

```yaml
DATAHUB_GMS_URL: "http://localhost:8080"   # → always unreachable on Cloud Run
ANTIGRAVITY_ATTACH_MCP: "false"
TOOLS_IS_MUTATION_ENABLED: "false"
ANTIGRAVITY_ENABLED: "true"
```

This is an explicit production choice: **agent demo without catalog**.

### `Dockerfile`

- Installs `uv` for MCP — good.
- Copies only backend packages — **no `examples/`** (paths are strings only; OK).
- No `GOOGLE_APPLICATION_CREDENTIALS` bake-in — ADC via Cloud Run SA assumed.

### `tests/test_pipeline_and_gate.py`

- Excellent honesty coverage for offline path.
- Scenario parity + example file existence.
- **Missing:** live MCP mock, Antigravity integration, API route tests, lift live path, frontend.

### Scripts

- `load_healthcare.sh`: depends on **gitignored** `resource/repositories/static-assets/...` — judges cloning public repo **cannot run** without separate clone.
- `bootstrap_midsphere_metadata.py`: **scaffold only** — prints TODO, creates nothing (`return 0`).
- `local_e2e.py`: good HTTP smoke; 30s timeout may be short for Antigravity.

---

## File-by-line findings (frontend)

### `App.tsx`

**Good:** heartbeats while waiting, stage streaming UX, offline fallback, keyboard shortcut, scenario switcher, trip/lift with sim STATUS offline.

**Issues:**

1. Offline **trip** sets `impacted: true` for `urn === target || hop > 0` — **over-quarantines** entire downstream tree visually (breaks selective-halt story).
2. Scenario switch only loads **static** `DEMO_JOB` / ecommerce / taxi — does not re-hit API with that root until Run scan.
3. Soft-progress while waiting marks stages DONE **before** real events arrive — can mislead for ~seconds.

### `lib/api.ts`

- `createJob` timeout **120s** — OK.
- `tripJob` / `lift` timeout **12s** — **trip re-runs full closed loop → almost always aborts** on live Antigravity.
- `loadCommandJob` → `/jobs/latest` can trigger server-side full job (expensive first load).

### `lib/types.ts` SCENARIOS

| Scenario | Frontend rootUrn | Backend expects |
| --- | --- | --- |
| healthcare | `...raw_patients` | match |
| ecommerce | `...raw_orders` | matches via `"ecommerce"` substring (OK) but not real raw_customers |
| nyctaxi | `...raw_trips` | matches `"trips"` (OK) vs backend `raw_yellow_trips` |

### `lib/demoJob.ts`

| Field | Offline DEMO_JOB | Backend healthcare |
| --- | --- | --- |
| risk_score | **72** | **61** |
| execution_mode | missing | set |
| aspects | present | **never returned by API** |

`DEMO_DIFF` / `DEMO_MBOM` are **healthcare-only** constants.

### `InspectorDrawer.tsx`

- Fix tab always renders **`DEMO_DIFF`** (healthcare SQL), even on ecommerce/taxi jobs or live jobs with different `job.pr.path`.
- MBOM tab always renders **`DEMO_MBOM`** (risk 72, billing), not `job.mbom` content or scenario file.
- Gate logic for selected node is careful about selective quarantine set — good.

**Severity:** P1 presentation honesty / multi-scenario fidelity.

### `LineageCanvas.tsx`

Invented presentation data not from job:

```ts
rows: hop===0 ? "1.2M rows" : ...
latency: hop===0 ? "72h stale" : "18ms"
riskScore: impacted ? (hop===0 ? 88 : 72) : 0
owner: hardcoded strings
edge label: isHot ? "PII Exposure" : "Clean Flow"  // even for healthcare quality!
```

Edges are **complete bipartite hop→hop+1**, not real lineage edges from DataHub.

Time travel only masks impact by hop — fine if labeled narrative (docs OK).

### `RagChat.tsx`

- Pure string matching.
- UI labels: **“Grounded Context”**, **“Grounded AI”**, **“Click to query grounded AI engine”**.
- Can overclaim MCP live mutations in canned answers relative to actual job flags.

**Severity:** P1 claim inflation (judges hate fake AI).

### `DataHubAspectsViewer.tsx`

- Badge **“GMS GraphQL Sync”** for local fixture aspects.
- Live API jobs: “No DataHub aspects recorded” (correct empty) — inconsistent product surface.

### `SwarmSidebar.tsx`

- Filters antigravity/gemini STATUS as system noise — good for demo cleanliness, hides truth of model path unless Raw.
- Fabricates **“180ms”** metric when done with no latency — cosmetic lie.
- Artifact CTAs for MBOM/Fix — good UX.

### `GatePreview.tsx`

- Correct advisory language. Good.

### Risk charts

- `RiskRadarChart` **derives fake dimensions** from single risk number (PII always 80 if risk>50, prod always 100). Looks scientific; is not.

---

## Skills / examples / docs

### Skills

- YAML frontmatter, approval-before-write, real tool names, no create_incident — **quality drafts**.
- Reference `../shared-references/` mentioned but **folder not present**.
- Not in `datahub-skills` upstream → bonus ~0 until PR.

### Examples

- Three PR diffs: healthcare quality filter, PII hash, taxi freshness — short but mergeable-looking.
- MBOMs labeled as offline examples — honest.
- Healthcare MBOM still says risk **72** while backend uses **61** — doc drift.
- Video: **script complete**, `export/` and `raw/` **empty**.

### Docs

- ARCHITECTURE / AGENTS / README / DESIGN / CHANGELOG: among the best honesty docs in a hackathon pack.
- `docs/FORENSIC_TIME_TRAVEL.md` correctly scopes scrubber vs GMS history.

---

## Live production re-probe (code-aligned)

```
GET /v1/health
  datahub: http://localhost:8080
  datahub_reachable: false
  mutations_env: false
  antigravity: true
  ANTIGRAVITY_ATTACH_MCP (env file): false
  official_mcp.tools: 0  (health probe disabled by default)

POST /v1/jobs (healthcare)
  status: succeeded
  execution_mode: antigravity_closed_loop
  mutations_applied: false
  datahub_reachable: false
  events: tool_call sequence midsphere_* with gemini-3.6-flash, mcp=False
```

Frontend: HTTP 200.  
Tests: 6 passed. Build: OK.

---

## Bug list (prioritized)

### P0 — judges / scoring

1. **No demo video** (required).  
2. **Prod GMS = localhost** → zero live DataHub on judge path.  
3. **Stage intelligence = URN scenario tables**; MCP results not consumed.  
4. **Primary path never mutates graph** (always job-local quarantine).

### P1 — honesty / fidelity

5. Inspector Fix/MBOM always healthcare `DEMO_*` regardless of job/scenario.  
6. Lineage UI fabricates rows/latency/PII edge labels.  
7. RagChat marketed as “Grounded AI” but is keyword rules.  
8. Aspects badge “GMS GraphQL Sync” on fixtures; API has no aspects.  
9. Offline DEMO risk 72 vs backend 61 vs formula 61.  
10. `tripJob` 12s timeout vs multi-minute/minute Antigravity re-run.  
11. Offline trip marks all hop>0 impacted (selective halt visual regression).  
12. Live `get_lineage` uses upstream; story is downstream blast.  
13. `list_schema_fields` always healthcare URN_RAW.  
14. `ensure_complete_fallback` means agent optional for success.  
15. `lift` never attempts live remove_tags.

### P2 — engineering

16. Process-local job store on Cloud Run.  
17. `GET /jobs/latest` auto-runs full job.  
18. Duplicate scenario tables (pipeline vs stage_tools).  
19. `compute_risk_score` dead code on happy path.  
20. `bootstrap_midsphere_metadata.py` is TODO scaffold.  
21. `load_healthcare.sh` requires non-shipped `resource/`.  
22. Frontend package `"private": true` (fine for deploy; repo is public).  
23. Repo name typo `datahb`.  
24. Empty dirs `components/scan`, `swarm`, `pages`.  
25. Skills `shared-references` missing.  
26. Official MCP process per call expensive.  
27. Bundle ~521kB.

### P3 — nits

28. Gate service nested ifs.  
29. Soft fake stage DONE during wait.  
30. Sidebar “180ms” invent.  
31. DESIGN mentions job metrics 2×2 grid; SwarmSidebar doesn’t fully match.

---

## Re-scored judging (after full read)

| Criterion | Before | **After deep read** | Why changed |
| --- | --- | --- | --- |
| Use of DataHub | 6.5 | **5.5–6.0** | Primary path never touches MCP; prod GMS offline; live reads unused for decisions |
| Technical Execution | 7.5 | **7.0** | Real Antigravity + solid plumbing, but core is switch-tables; trip timeout bug; dual-source risk |
| Originality | 8.5 | **8.5** | Unchanged — product thesis still novel |
| Real-World Usefulness | 8.0 | **7.5** | Pattern useful; implementation is demo-complete not ops-complete |
| Submission Quality | 6.0 | **5.5** | Video missing; multi-scenario UI shows wrong fix/MBOM undercuts polish |
| Bonus OSS | 3.0 | **3.0** | Unchanged |
| **Composite** | ~7.3 | **~6.7–7.0** | Still competitive if video + honest framing; weaker if judge opens Fix on ecommerce |

---

## What still impresses me (after reading every line)

1. **Honesty infrastructure** — `execution_mode`, `mutations_applied`, `sim` telemetry, gate policy text, forbidden tool asserts. Most teams fail this.  
2. **End-to-end demable loop** — scan → stages → selective graph → gate → fix/MBOM narrative works in one click.  
3. **Antigravity really runs in prod** — not a mock “agent” banner.  
4. **Official MCP client is real code**, not vaporware — just under-wired.  
5. **Deploy isolation + CI** is adult.  
6. **Docs** match code better than 90% of hackathon repos (even when code is demo-heavy).

---

## What I would tell you as a friend, not a cheerleader

Stop polishing glass (radar, time travel chrome, aspect badges) until the spine is honest:

1. Either **attach a real GMS** to Cloud Run, or **stop implying** MCP in the live demo voice.  
2. Either **parse lineage into nodes**, or **label scenarios** “seeded scenario packs for planted issues” in UI chrome.  
3. Fix Inspector to show **scenario-correct** diff/MBOM (3 constants is enough).  
4. Relabel Audit Q&A to **“Operator FAQ (local rules)”** — zero cost, high integrity.  
5. Record the **video**. Without it nothing else matters for Devpost.

The project is **not fake**. It is **demo-intelligent** with a **production agent shell**. Own that, tighten the 5 honesty bugs above, wire GMS if you can, and you have a submission judges can respect.

---

## Suggested score-maximizing 48h plan

| Hours | Work |
| --- | --- |
| 2 | Fix Fix/MBOM inspector per scenario; fix RagChat labels; remove “GMS GraphQL Sync” |
| 2 | Fix trip timeout; offline trip selective impact; risk 72→61 demo parity |
| 4–8 | Stand up GMS + set Cloud Run `DATAHUB_GMS_URL`; seed healthcare; enable attach MCP or fallback live reads |
| 4 | Parse `get_lineage` into blast nodes when live (fallback scenario still OK) |
| 2 | Open datahub-skills PR for circuit-breaker skill |
| 3 | Record + upload video from existing script |
| 1 | Devpost text matching honest modes |

---

*Deep audit complete. Code was read, not skimmed.*
