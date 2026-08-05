# MidSphere 2.0 — Comprehensive Changelog

All notable changes, architectural upgrades, ergonomics redesigns, and audit resolutions completed during this session on branch `v2-ergonomics-redesign`.

---

## 🎨 1. Master Lineage Canvas Redesign (Palantir × Vercel × Linear Level Craft)

### Glassmorphic Observability Cards ([`CustomNode.tsx`](file:///home/adi-IL/ILdev/Projects/competitions/Devpost/datahub-hackathon/frontend/src/components/graph/CustomNode.tsx))
- **Thin 3.5px Left Accent Bar:** Gives instant vertical status recognition (`#ef4444` crimson pulse for `IMPACTED` vs `#10b981` emerald for `OPEN`).
- **Dynamic Micro Risk Heat Bar:** Replaces plain risk numbers with a glowing horizontal heat bar (`0–30` green, `31–70` yellow, `71–100` crimson).
- **Platform Badges:** Added icon-backed platform badges (`❄️ Snowflake`, `🟧 dbt model`, `⚡ BigQuery`, `📦 SQLite`).
- **Hover Story Tooltips:** Hovering any dataset card reveals Data Platform, Owner, Freshness SLA breach status, and Downstream asset count.
- **Node Spacing & Zero Overlap Layout:** Expanded horizontal gap to `380px` (providing a 145px channel for edge labels) and vertical gap to `220px` (50px vertical card clearance), eliminating all card collisions.

### Circuit Stress vs Calm Flow Edges ([`CustomEdge.tsx`](file:///home/adi-IL/ILdev/Projects/competitions/Devpost/datahub-hackathon/frontend/src/components/graph/CustomEdge.tsx))
- **Orthogonal 45° Smoothstep Routing:** Clean right-angle edge paths eliminating diagonal line tangles.
- **Circuit Under Stress (`PII Exposure`):** Dual-stroke path with animated glowing laser particles and a red midpoint throughput pill.
- **Calm Flow (`Clean Flow`):** Soft dashed green pulse line with an emerald midpoint pill.

### Forensic Time Travel Mode ([`TimeTravelBar.tsx`](file:///home/adi-IL/ILdev/Projects/competitions/Devpost/datahub-hackathon/frontend/src/components/graph/TimeTravelBar.tsx) & [`docs/FORENSIC_TIME_TRAVEL.md`](file:///home/adi-IL/ILdev/Projects/competitions/Devpost/datahub-hackathon/docs/FORENSIC_TIME_TRAVEL.md))
- **5-Step Forensic Timeline Controller:** Interactive scrub slider and Play/Pause controller allowing frame-by-frame replay of contamination spread:
  - `T-0` (`09:20:00` Baseline): All nodes `OPEN`, Risk 0, `Clean Flow` emerald streams.
  - `T-1` (`09:24:12` Sentinel): Anomaly detected on ingestion source (`raw_patients`, `raw_customers`, `raw_yellow_trips`).
  - `T-2` (`09:28:45` Cascade): Contamination propagates downstream into dbt staging models.
  - `T-3` (`09:31:02` Circuit Breaker): Advisory quarantine applied (`QUARANTINED` tags published). Target mart blocked, while unaffected forks remain `OPEN` (Selective Circuit Breaking).
  - `T-4` (`09:35:10` Attested): Automated dbt SQL fix diff & MBOM audit attestation published.

---

## 🤖 2. Audit Q&A Assistant & Interactive Action Control Buttons

### Upgraded Audit Q&A Assistant ([`RagChat.tsx`](file:///home/adi-IL/ILdev/Projects/competitions/Devpost/datahub-hackathon/frontend/src/components/inspect/RagChat.tsx))
- Transformed into a grounded conversational AI assistant handling queries for:
  - Trip Circuit & Lift Quarantine button operations
  - Selective Circuit Breaking & open lineage forks
  - dbt SQL remediation diffs & filter conditions
  - DataHub MCP server integration (`mcp-server-datahub`), tags, and structured properties
  - Risk score formulas, severity weights, and blast radius calculation

### Interactive Control Buttons Wiring ([`InspectorDrawer.tsx`](file:///home/adi-IL/ILdev/Projects/competitions/Devpost/datahub-hackathon/frontend/src/components/layout/InspectorDrawer.tsx), [`App.tsx`](file:///home/adi-IL/ILdev/Projects/competitions/Devpost/datahub-hackathon/frontend/src/App.tsx), & [`api.ts`](file:///home/adi-IL/ILdev/Projects/competitions/Devpost/datahub-hackathon/frontend/src/lib/api.ts))
- **`Trip circuit`:** Calls `/v1/jobs/{id}/trip` (or updates job-local state when offline), setting `gateStatus = BLOCKED`, tripping canvas nodes to glowing red (`● IMPACTED`), and updating Consumer Gate enforcement.
- **`Lift quarantine`:** Calls `/v1/jobs/{id}/lift` (or updates job-local state when offline), setting `gateStatus = LIFTED`, unblocking canvas nodes to emerald green (`● OPEN`), and logging telemetry.

---

## 🛡️ 3. Audit Issues Resolution (`issues/v2-ergonomics-redesign-audit.md`)

All **8 audit issues** identified on branch `v2-ergonomics-redesign` have been fully resolved:

1. **Scenario Parity (Issue 1 & 2):** Refactored `backend/agents/stage_tools.py` with a single source of truth scenario contract (`_get_scenario_spec`) for Healthcare, E-Commerce, and NYC Taxi scenarios across all 5 custom tools (`midsphere_context_sentinel_audit`, `midsphere_cascade_analyzer`, `midsphere_circuit_breaker_trip`, `midsphere_fix_architect`, `midsphere_mbom_engine`).
2. **Missing Example Artifacts (Issue 3):** Created 4 missing tracked example files:
   - `examples/prs/fix-pii-masking.example.diff`
   - `examples/prs/fix-taxi-freshness.example.diff`
   - `examples/mboms/ecommerce-pii-mbom.example.md`
   - `examples/mboms/nyctaxi-revenue-mbom.example.md`
3. **Telemetry Honesty Enforced (Issue 4):** Cleaned all offline demo job events (`demoJob.ts`) to use `kind: "STATUS"` and `sim ` prefix (`sim get_lineage`, `sim add_tags`, `sim save_document`).
4. **Action Button Status Logging (Issue 5):** Updated `App.tsx` handlers to log `kind: "STATUS"` for UI button submissions instead of synthetic `WRITE` events.
5. **Mode-Aware Q&A Copy (Issue 6):** Updated `RagChat.tsx` copy to accurately describe API-backed job state updates vs optional live DataHub MCP mutations when `TOOLS_IS_MUTATION_ENABLED=true` is set.
6. **Process-Local Storage (Issue 7):** Added `"storage": "process-local (file-backed)"` to `/v1/health` and implemented file-backed JSON job persistence (`.midsphere/jobs.json`).
7. **Dynamic GMS Reachability Probe (Issue 8):** Probed GMS reachability dynamically in `backend/agents/antigravity_runner.py`.

---

## 🔒 4. Trusted Execution Environment (TEE) Planning

- **TEE Architecture Plan ([`midsphere_tee_integration_plan.md`](file:///home/adi-IL/.gemini/antigravity-cli/brain/78733879-7115-409b-ab75-724c277eb182/midsphere_tee_integration_plan.md)):**
  - Outlined hardware-attested confidential computing (`MRENCLAVE` quote hashes, AMD SEV-SNP / Intel SGX / AWS Nitro / GCP Confidential VMs).
  - Outlined TEE quote verification inside the Consumer Gate (`GET /v1/gate/{urn}`) and cryptographic attestation publishing to DataHub via `save_document`.

---

## ✅ 5. Final Verification & Git Status

- **Git Branch:** `v2-ergonomics-redesign`
- **Latest Commit:** `3e07e76` (`fix(honesty): sanitize NYCTAXI demo events, UI action status logging, and RagChat copy`)
- **Git Worktree:** `nothing to commit, working tree clean`
- **Backend Unit Tests:** `python -m pytest tests -q` $\rightarrow$ **6 passed in 0.20s**
- **Frontend Build:** `npm run build` $\rightarrow$ **Built in 4.20s (0 errors)**
- **Demo Job Grep Search (`kind: "TOOL" | kind: "WRITE"`):** **0 results found**
