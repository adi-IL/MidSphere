# MidSphere — Full Project Audit

**Date:** 2026-08-06  
**Scope:** Entire MidSphere product vs [Build with DataHub: The Agent Hackathon](../datahub-agent-hackathon.md) + engineering quality, honesty, and submission readiness.  
**Deadline:** Registration & Submission ends **August 10, 2026 05:00 pm ET** (~Aug 11 02:30 GMT+5:30).  
**Repo:** https://github.com/adi-IL/MidSphere-datahb  
**Live:** https://midsphere.vercel.app · API Cloud Run `midsphere-api`

This audit supersedes the historical `v2-ergonomics-redesign-audit.md` as the current risk picture (that file remains a branch history record).

---

## Executive summary

MidSphere is a **strong, demable, honesty-conscious** submission for **Agents That Do Real Work**, with secondary narrative coverage of **Metadata-Aware Code Generation** (dry-run fix diffs) and a thin **Production ML Agents** claim.

| Dimension | Score (0–10) | Verdict |
| --- | --- | --- |
| **Use of DataHub** | **6.5** | Correct MCP contracts + write-back *path*; production GMS offline; findings **not** derived from live graph |
| **Technical Execution** | **7.5** | End-to-end works; tests/build green; Antigravity live on Cloud Run; scenario logic hardcoded |
| **Originality** | **8.5** | Context-entropy → selective circuit-breaker + MBOM + Consumer Gate is novel vs catalog chat wrappers |
| **Real-World Usefulness** | **8.0** | Real practitioner pain; advisory quarantine + selective halt is credible; not production-hardened |
| **Submission Quality** | **6.0** | README/live demo strong; **demo video missing**; Devpost description not verified here |
| **Bonus OSS contribution** | **3.0** | Quality skills drafted under `skills/` but **not upstreamed** to datahub-skills |
| **Overall readiness** | **7.0 / 10** | Competitive if video + optional live GMS land before deadline; not Grand Prize-safe without deeper graph-driven intelligence |

**Top 5 actions before submit (priority order):**

1. **Record and upload the &lt;3 min demo video** (script exists; `examples/video/export/` is empty).
2. **Wire production to a reachable DataHub GMS** (or Cloud DataHub) so judges see `datahub_reachable=true` and at least one live MCP read.
3. **Feed MCP outputs into stage decisions** (lineage → blast nodes; schema/quality signals → findings) instead of pure URN scenario tables.
4. **Open a PR to `datahub-project/datahub-skills`** with `datahub-circuit-breaker` + `datahub-quality-circuit` (bonus criterion).
5. **Tighten Devpost copy** to match honest modes (`antigravity_closed_loop` / job-local quarantine when GMS offline).

---

## 1. Hackathon fit

### 1.1 Challenge category mapping

| Challenge | MidSphere mapping | Strength |
| --- | --- | --- |
| **Agents That Do Real Work** | 5-stage closed loop via Antigravity + tools; optional MCP write-back | **Primary — strong** |
| **Metadata-Aware Code Generation** | FixArchitect + `examples/prs/*.diff` | **Secondary — sample artifacts only**, not schema-driven generation |
| **Production ML Agents** | ARCHITECTURE claims optional ML leakage | **Weak / aspirational** — healthcare demo is quality, not ML lineage |
| **Open / Wildcard** | N/A (focused product) | — |

**Requirement check (Stage One pass/fail):** Project uses DataHub via **MCP Server** (official `mcp-server-datahub` client + optional Antigravity attach). Skills drafted (not required to pass Stage One if MCP is used). **Stage One: PASS.**

### 1.2 Mandatory submission checklist

| Requirement | Status | Evidence |
| --- | --- | --- |
| Working software using DataHub (MCP / ACK / Skills / Analytics Agent) | **Partial-pass** | MCP path + skills drafts; production GMS offline |
| Project URL for judges | **Pass** | https://midsphere.vercel.app |
| Public repo + Apache 2.0 LICENSE | **Pass** | LICENSE present; Apache 2.0 |
| Text description (Devpost) | **Unknown** | Not audited on Devpost UI |
| Demo video &lt; 3 min, public YouTube/Vimeo | **FAIL / missing** | Script only; `export/` and `raw/` empty |
| Sample outputs (recommended) | **Pass** | `examples/mboms`, `examples/prs`, `examples/telemetry` |
| New project in submission period | **Assumed** | Not independently verified |
| English materials | **Pass** | All docs English |

---

## 2. Judging criteria deep dive

### 2.1 Use of DataHub (weight: equal)

**What is strong**

- Real unprefixed MCP tool allowlist (`search`, `get_lineage`, `add_tags`, `save_document`, …) in `midsphere_mcp/client.py` and `official.py`.
- Explicit bans on invented `datahub_*` / `create_incident` MCP tools + telemetry asserts in tests.
- Official server launch path: `uvx mcp-server-datahub@latest` over stdio.
- Write-back design: tags + structured properties + documents (OSS-correct); incidents called out as Cloud GraphQL only.
- Consumer Gate policy text correctly states quarantine is **advisory**, not platform-wide MCP auto-denial.
- Docs (README / ARCHITECTURE / AGENTS) align with real DataHub contracts — rare and judge-visible honesty.

**What is weak**

| Issue | Severity | Detail |
| --- | --- | --- |
| Production GMS offline | **P0 for Use of DataHub score** | Live `/v1/health`: `datahub_reachable=false`, `datahub=http://localhost:8080`, `official_mcp.tools=0` |
| Findings not graph-driven | **P0** | `_get_scenario_spec(root_urn)` hardcodes findings/nodes/risk by URN string (`healthcare` / `ecommerce` / `nyctaxi`) in both `stage_tools.py` and `pipeline.py` |
| Antigravity primary ignores MCP for decisions | **P1** | Production job: `mcp=False`; tools return canned scenario JSON; circuit breaker sets `mutations_applied=False` always in stage tools |
| Fallback live MCP reads don’t reshape blast radius | **P1** | When GMS is up, pipeline may call `get_lineage` / `list_schema_fields` / `search` but still applies scenario tables for findings/nodes |
| Fix path not MCP-schema-aware | **P2** | Points at static example diffs; no `list_schema_fields` → generated SQL |
| Skills not submitted upstream | **P2** | Bonus criterion unrealized |

**Live production sample (2026-08-06):**

```text
POST /v1/jobs → status=succeeded
execution_mode=antigravity_closed_loop
mutations_applied=false
datahub_reachable=false
model=gemini-3.6-flash mcp=False
tools: midsphere_* custom only (scenario-backed)
```

**Score rationale (6.5):** Judges reward meaningful bidirectional graph use. Architecture and honesty are excellent; **runtime demo currently under-uses DataHub**. Wiring a public/quickstart GMS and making one stage consume live lineage would move this toward 8+.

---

### 2.2 Technical Execution

**Verified green**

| Check | Result |
| --- | --- |
| `pytest backend/tests` | **6 passed** |
| `npm run build` (frontend) | **OK** (chunk ~521 kB warning only) |
| Frontend HTTP | **200** |
| API health | **ok** |
| POST closed-loop job | **succeeded** (~20s) Antigravity primary |
| Telemetry honesty tests | Present (`sim` offline; no fake live TOOL) |
| Gate lift | Unit-tested |
| Scenario parity (3 scenarios) | Unit-tested; example PR/MBOM paths exist |
| Deploy isolation | frontend→Vercel, backend→Cloud Run, path-filtered Actions |
| Secrets hygiene | `.env` gitignored; `.env.example` placeholders |

**Architecture (shipping)**

```
POST /v1/jobs
  → run_closed_loop
       PRIMARY: Antigravity Agent + 5 midsphere_* tools
       FALLBACK: deterministic pipeline (+ optional official MCP)
  → JobArtifact (execution_mode, mutations_applied, datahub_reachable)
```

**Weaknesses**

| Issue | Severity | Notes |
| --- | --- | --- |
| Stage tools are deterministic scripts behind an agent | **P1** | Agent orders tools; intelligence is not in catalog reasoning. `ensure_complete_fallback()` completes job even if agent skips tools → softens “agent must work” |
| Antigravity circuit breaker never mutates live graph | **P1** | Job-local quarantine only; live mutations only on fallback path with mutations enabled |
| Process-local job store | **P2** | Health: `storage=process-local (file-backed)` — multi-instance Cloud Run can lose “latest job” consistency |
| Frontend createJob timeout 120s | **P2** | Cold start + model retries may still fail; offline `DEMO_JOB` fallback mitigates |
| Empty component dirs (`scan/`, `swarm/`, `pages/`) | **P3** | Noise only |
| Repo name typo `datahb` | **P3** | Branding / discoverability |
| Local workspace 2.1G due to ignored `resource/` | **P3** | Not shipped in git (0 tracked files under `resource/`) |

**Score rationale (7.5):** It does what it claims in demo mode; Antigravity actually runs in production; tests and CI exist. Cap below 9 because core audit/cascade logic is scenario tables, not robust dataplane intelligence.

---

### 2.3 Originality

**Novel composition (not a rebuild of DataHub UI):**

1. **Context Entropy** framing for agent-era metadata failure.
2. **Selective quality circuit-breaker** (billing blocked, demographics open).
3. **Closed-loop swarm** with fix artifact + **MBOM attestation** narrative.
4. **Consumer Gate** as explicit MidSphere policy (honest vs “MCP blocks everyone”).
5. **Forensic Time Travel** scrubber + Command Center three-pane operator UX.

Avoids “another RAG chat over the catalog.” Does not reimplement DataHub search/lineage as the product core.

**Score: 8.5**

---

### 2.4 Real-World Usefulness

Practitioners face: silent quality issues, agents consuming bad context, over-broad pipeline halts, missing durable remediation memory.

MidSphere’s selective halt + advisory quarantine + fix PR + MBOM is a plausible ops pattern. Caveats for real teams:

- Needs real assertion/quality signal ingestion (not planted scenario strings).
- Gate must be adopted by consumers (Analytics Agent / internal agents) to matter.
- GitHub PR creation is dry-run path only today.
- Multi-tenant storage, auth, and audit log retention missing.

**Score: 8.0** (problem real; implementation is hackathon-credible, not production-ready — allowed by rules).

---

### 2.5 Submission Quality

| Asset | Status |
| --- | --- |
| README | Strong thesis, live URLs, quick start, honesty |
| ARCHITECTURE / DESIGN / AGENTS | Excellent for judges who dig |
| Examples | MBOMs + PR diffs + telemetry + video script |
| Live demo | Works without local setup |
| Demo video | **Missing** — critical gap |
| Devpost written entry | Not verified in this audit |
| Apache 2.0 visible | LICENSE present |

**Score: 6.0** until video + polished Devpost blurb land. With video matching the script: ~8.5.

---

### 2.6 Bonus: Open-source contribution

| Item | Status |
| --- | --- |
| `skills/datahub-circuit-breaker` | Local draft, YAML frontmatter, good honesty language |
| `skills/datahub-quality-circuit` | Local draft |
| PR to datahub-skills / datahub core | **Not found in repo** |
| Connectors / fixes / RFCs upstream | **None in product tree** |

**Score: 3.0** — draft quality is submission-ready for a skills PR; value is unlocked only when upstreamed before/during judging.

---

## 3. Honesty & policy audit (AGENTS.md mandates)

| Mandate | Status |
| --- | --- |
| DataHub as system of record | **Partial** — preferred when reachable; scenarios dominate offline |
| Advisory quarantine; `mutations_applied` honesty | **Pass** (prod job `false`) |
| No claim of platform-wide MCP auto-denial | **Pass** (gate + docs + tests) |
| Real MCP tool names only | **Pass** (tests reject `datahub_*`) |
| TOOL/WRITE only after real attempts; `sim` for demo | **Pass** on fallback; Antigravity TOOL events are for `midsphere_*` custom tools (allowed) |

**Honesty grade: A−**  
Docs and telemetry contracts are a competitive differentiator. Do not break them in video narration.

---

## 4. Other engineering parameters

### 4.1 Security

- No secrets observed in tracked source; `.gitignore` covers `.env`, keys, SAs.
- CLI/URN shell metacharacter guidance in skills; strip noted in AGENTS.
- Gate is job-local — not a security boundary for arbitrary multi-tenant tenants.
- Cloud Run CORS allows production frontend origin via settings.

### 4.2 Testing

- Focused, high-signal unit tests (honesty, gate, scenarios).
- Gaps: no integration test with real `mcp-server-datahub`; no frontend e2e in CI (Playwright script exists under `frontend/scripts/`); no load/timeout test for Antigravity.

### 4.3 Observability / ops

- Job events stream is demable.
- Health exposes stack flags honestly.
- CI: typecheck + pytest on PRs; path-filtered deploys; Vercel token keepalive.

### 4.4 Frontend product

- Command Center: TopBar, SwarmSidebar terminal, LineageCanvas, Inspector, TimeTravel, Risk radar, Audit Q&A.
- Offline demo fixtures for 3 scenarios — good for judges offline.
- Risk: large JS bundle (~521 kB); acceptable for demo.

### 4.5 Data / samples

- Healthcare narrative aligns with official sample dataset quality plants.
- Ecommerce / NYC taxi are **scenario mirrors**, not proven live datapack loads in prod.
- Load script: `./scripts/load_healthcare.sh`.

---

## 5. Risk matrix (submit impact)

| ID | Risk | Impact if judges notice | Mitigation |
| --- | --- | --- | --- |
| R1 | No demo video | Submission incomplete / low Submission Quality | Record from `DEMO_VIDEO_SCRIPT.md` |
| R2 | GMS offline on live demo | “Doesn’t really use DataHub” | Point Cloud Run at hosted GMS + seed healthcare |
| R3 | Hardcoded findings | Technical Execution / Use of DataHub penalty | Derive blast from live `get_lineage`; keep scenarios as offline fallback only |
| R4 | Overclaim ML agents | Originality/honesty hit | Drop ML claims from Devpost or build one ML lineage scenario |
| R5 | Video claims live tags while offline | Integrity fail | Script already warns; stick to script |
| R6 | Skills never upstreamed | Missed bonus | 1 focused PR to datahub-skills |
| R7 | Antigravity cost/latency on cold start | Judge abandons Run scan | Warm-up before video; show offline demo if needed |

---

## 6. Recommended work plan (pre-deadline)

### Must-do (submission blockers)

1. Record demo video (≤2:55), upload YouTube/Vimeo public, link on Devpost.
2. Fill Devpost: description, project URL, repo URL, video, optional images from existing `midsphere_*.png` screenshots.
3. Confirm Apache 2.0 shows on GitHub About (LICENSE already present).

### Should-do (score movers)

4. Deploy reachable GMS (Cloud DataHub trial or small GCE/quickstart) and set `DATAHUB_GMS_URL` / token on Cloud Run; seed healthcare lineage.
5. In `midsphere_cascade_analyzer` / fallback: if live `get_lineage` returns nodes, prefer them for blast_radius; scenario table as fallback only.
6. In circuit breaker Antigravity path: attempt official MCP `add_tags` when mutations enabled (parity with fallback).
7. Open skills PR(s) to `datahub-project/datahub-skills`.

### Nice-to-have

8. Real GitHub PR open for FixArchitect when `GITHUB_TOKEN` set.
9. Frontend code-split for bundle size.
10. Rename remote repo `MidSphere-datahb` → `MidSphere` (optional; redirects).
11. One ecommerce/nyctaxi datapack note in README for local judges.

---

## 7. Suggested Devpost positioning (honest)

**Title:** MidSphere — Context Circuit-Breaker for DataHub  

**One-liner:** When context goes bad, trip a selective breaker in the graph — quarantine, fix, and MBOM — so the next agent inherits safer knowledge.  

**Category emphasis:** Agents That Do Real Work (primary).  

**What judges should click:** Live Command Center → Run scan → selective billing BLOCKED / demographics OPEN → Gate + MBOM tabs.  

**What not to say:** “MCP auto-blocks all agents,” “we always write live tags,” “ML leakage detector” (unless built).

---

## 8. Scorecard snapshot

```
Use of DataHub ........ 6.5 / 10
Technical Execution ... 7.5 / 10
Originality ........... 8.5 / 10
Real-World Usefulness . 8.0 / 10
Submission Quality .... 6.0 / 10  (→ ~8.5 with video)
Bonus OSS ............. 3.0 / 10  (→ ~8 with upstream PR)

Composite (equal weights, no bonus): ~7.3 / 10
With video + live GMS + lineage-driven cascade: ~8.3–8.7 competitive band
```

---

## 9. Evidence appendix (commands / probes)

```bash
# Health (prod)
curl -sS "$API/v1/health"
# → datahub_reachable=false, antigravity=true, use_official_mcp=true

# Job (prod)
curl -sS -X POST "$API/v1/jobs" -H 'Content-Type: application/json' \
  -d '{"root_urn":"urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)","mode":"full","auto_trip":true}'
# → execution_mode=antigravity_closed_loop, mutations_applied=false

# Local verification
cd backend && python -m pytest tests -q   # 6 passed
cd frontend && npm run build              # success
```

Key code anchors:

- Scenario hardcoding: `backend/agents/stage_tools.py` (`_get_scenario_spec`)
- Fallback scenarios + optional live MCP: `backend/agents/pipeline.py`
- Official MCP: `backend/midsphere_mcp/official.py`
- Antigravity: `backend/agents/antigravity_runner.py`
- Gate: `backend/gate/service.py`
- Tests: `backend/tests/test_pipeline_and_gate.py`

---

## 10. Audit status

| Phase | Status |
| --- | --- |
| Hackathon rules & criteria | Done |
| Docs / architecture alignment | Done |
| Backend + MCP + Antigravity | Done |
| Frontend + live deploy smoke | Done |
| Tests / build | Done |
| Submission package | **Video gap** |
| Follow-up implementation | Not started (this audit only) |

*End of audit.*
