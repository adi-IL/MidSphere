# v2-ergonomics-redesign Branch Audit

Branch under audit: `v2-ergonomics-redesign`

Commit audited: `741f0266eca40c1317e3c9d5dedc0fb88221dff9`

Scope: this document covers issues found on this branch only. It does not make claims about `main`; the purpose is to make this branch correct and polished before unifying it back.

## Manual Verification Performed

Commands run from repo root unless noted.

```bash
git branch --show-current
```

Observed:

```text
v2-ergonomics-redesign
```

```bash
cd backend
python -m pytest tests -q
```

Observed:

```text
.....                                                                    [100%]
5 passed in 0.33s
```

```bash
cd frontend
npm run build
```

Observed:

```text
> midsphere-frontend@0.1.0 build
> tsc -b && vite build

vite v6.4.3 building for production...
transforming...
✓ 462 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   2.51 kB │ gzip:   1.06 kB
dist/assets/index-aNq1K7kA.css   42.19 kB │ gzip:   8.22 kB
dist/assets/index-CIE9uDjT.js   520.56 kB │ gzip: 164.52 kB

(!) Some chunks are larger than 500 kB after minification.
✓ built in 4.04s
```

Scenario parity check:

```bash
python - <<'PY'
import sys, os
sys.path.insert(0, 'backend')
os.environ['ANTIGRAVITY_ENABLED']='false'
from agents.stage_tools import MidSphereJobBuilder
from agents.pipeline import run_closed_loop
from midsphere_mcp.client import McpClient

roots = {
 'healthcare':'urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)',
 'ecommerce':'urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.raw_customers,PROD)',
 'nyctaxi':'urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.raw_yellow_trips,PROD)',
}
for name, root in roots.items():
    b = MidSphereJobBuilder(root)
    b.midsphere_context_sentinel_audit(root)
    b.midsphere_cascade_analyzer()
    b.midsphere_circuit_breaker_trip(True)
    b.midsphere_fix_architect()
    b.midsphere_mbom_engine()
    bj = b.to_job()
    fj = run_closed_loop(root, client=McpClient(gms_url='http://127.0.0.1:1', timeout=0.2))
    print(name, 'builder_risk', bj.blast_radius['risk_score'], 'builder_q', bj.quarantine.entityUrns if bj.quarantine else None, 'fallback_risk', fj.blast_radius['risk_score'], 'fallback_q', fj.quarantine.entityUrns if fj.quarantine else None, 'fallback_pr', fj.pr.get('path') if fj.pr else None)
PY
```

Observed:

```text
healthcare builder_risk 61 builder_q ['urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)'] fallback_risk 61 fallback_q ['urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)'] fallback_pr examples/prs/fix-negative-billing.example.diff
ecommerce builder_risk 61 builder_q ['urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)'] fallback_risk 88 fallback_q ['urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)'] fallback_pr examples/prs/fix-pii-masking.example.diff
nyctaxi builder_risk 61 builder_q ['urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)'] fallback_risk 65 fallback_q ['urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)'] fallback_pr examples/prs/fix-taxi-freshness.example.diff
```

Tracked example artifact check:

```bash
git ls-files examples/prs examples/mboms frontend/src/components frontend/src/lib | sort
```

Relevant observed output:

```text
examples/mboms/healthcare-billing-mbom.example.md
examples/prs/fix-negative-billing.example.diff
```

## Issues

### 1. Antigravity Primary Path Quarantines The Wrong Entity For New Scenarios

Severity: High

Status: confirmed by manual terminal test.

Why this is an issue:

The branch adds multiple frontend/backend scenarios: healthcare, ecommerce, and nyctaxi. The deterministic fallback path returns scenario-specific quarantine targets, but the Antigravity custom-tool builder still quarantines the healthcare billing mart for ecommerce and nyctaxi runs. This means the primary workforce path can produce an artifact that contradicts the selected scenario and the UI story.

Evidence in code:

- `backend/agents/stage_tools.py`: `midsphere_context_sentinel_audit` and `midsphere_cascade_analyzer` contain scenario-specific branches for ecommerce and nyctaxi.
- `backend/agents/stage_tools.py`: `midsphere_circuit_breaker_trip` sets `targets = [URN_BILLING]` unconditionally.
- `backend/agents/stage_tools.py`: `midsphere_fix_architect` always uses `examples/prs/fix-negative-billing.example.diff`.
- `backend/agents/stage_tools.py`: `midsphere_mbom_engine` always uses `examples/mboms/healthcare-billing-mbom.example.md` and related asset `[URN_BILLING]`.

Terminal proof:

```text
ecommerce builder_q ['urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)']
nyctaxi builder_q ['urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)']
```

Expected on this branch:

- Ecommerce should quarantine `urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)`.
- NYCTaxi should quarantine `urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)`.

Fix plan:

Create one shared scenario contract in backend code and make all five custom tools use it:

- findings
- blast radius nodes
- risk score
- quarantine URNs
- tags
- PR path and summary
- MBOM path and document URN

Add tests that directly instantiate `MidSphereJobBuilder` for ecommerce and nyctaxi and assert the quarantine targets are scenario-correct.

### 2. Antigravity Primary Path Overwrites Scenario Risk Scores

Severity: High

Status: confirmed by manual terminal test.

Why this is an issue:

The branch presents different risks per scenario: ecommerce is high-risk PII governance, nyctaxi is freshness/SLA risk, and healthcare is quality risk. In `MidSphereJobBuilder`, scenario-specific scores are assigned and then overwritten with a generic formula call using the same parameters for every scenario. The result is all primary-path scenarios returning `61`.

Evidence in code:

- `backend/agents/stage_tools.py`: ecommerce sets `self.risk_score = 88`.
- `backend/agents/stage_tools.py`: nyctaxi sets `self.risk_score = 65`.
- `backend/agents/stage_tools.py`: after those branches, `self.risk_score = compute_risk_score(...)` runs for every scenario with fixed inputs.

Terminal proof:

```text
healthcare builder_risk 61
ecommerce builder_risk 61
nyctaxi builder_risk 61
```

Fallback path proof that branch intent is scenario-specific:

```text
ecommerce fallback_risk 88
nyctaxi fallback_risk 65
```

Expected on this branch:

- Healthcare primary path should match healthcare branch risk.
- Ecommerce primary path should preserve ecommerce risk.
- NYCTaxi primary path should preserve nyctaxi risk.

Fix plan:

Move risk into the shared scenario contract or compute it from scenario-specific inputs. Do not overwrite scenario-specific risk with a fixed call. Add tests that compare builder risk and fallback risk for each scenario.

### 3. Scenario PR And MBOM Paths Reference Missing Tracked Files

Severity: High

Status: confirmed by manual terminal test.

Why this is an issue:

The branch returns PR and MBOM paths for ecommerce and nyctaxi, and the frontend demo job also displays those paths. Those files are not tracked. A judge or operator opening the artifact path will only find the healthcare examples.

Evidence in code:

- `backend/agents/pipeline.py` references `examples/prs/fix-pii-masking.example.diff`.
- `backend/agents/pipeline.py` references `examples/mboms/ecommerce-pii-mbom.example.md`.
- `backend/agents/pipeline.py` references `examples/prs/fix-taxi-freshness.example.diff`.
- `backend/agents/pipeline.py` references `examples/mboms/nyctaxi-revenue-mbom.example.md`.
- `frontend/src/lib/demoJob.ts` repeats the same ecommerce and nyctaxi paths.

Terminal proof:

```text
examples/mboms/healthcare-billing-mbom.example.md
examples/prs/fix-negative-billing.example.diff
```

Expected on this branch:

All artifact paths returned by backend and displayed by frontend should point to tracked files.

Fix plan:

Add these files:

- `examples/prs/fix-pii-masking.example.diff`
- `examples/prs/fix-taxi-freshness.example.diff`
- `examples/mboms/ecommerce-pii-mbom.example.md`
- `examples/mboms/nyctaxi-revenue-mbom.example.md`

Add a test or small validation that every `pr.path` and `mbom.path` used by built-in scenarios exists in the repository.

### 4. Offline Demo Events Claim Real Tool And Write Activity

Severity: High

Status: confirmed by code inspection and branch contract.

Why this is an issue:

`AGENTS.md` requires telemetry honesty: `TOOL` and `WRITE` should only be used after a real MCP attempt. Deterministic demo steps should be `STATUS` lines prefixed with `sim `. The frontend offline demo artifacts include `TOOL`, `WRITE`, and `MBOM` events that read like real MCP activity.

Evidence in code:

- `frontend/src/lib/demoJob.ts` healthcare demo includes `kind: "TOOL"` with `get_lineage`.
- `frontend/src/lib/demoJob.ts` healthcare demo includes `kind: "TOOL"` with `add_tags`.
- `frontend/src/lib/demoJob.ts` healthcare demo includes `kind: "WRITE"` with `gate_status=BLOCKED ok`.
- Ecommerce and nyctaxi demo events follow the same pattern.

Why this matters:

The app can enter offline demo mode through `frontend/src/lib/api.ts` when `/v1/jobs/latest` is unavailable. In that mode, the UI can show apparent tool/write success that did not happen.

Expected on this branch:

Offline demo events should be honest. Simulated steps should be represented as `kind: "STATUS"` and messages should begin with `sim `, for example:

```text
sim get_lineage urn=... (demo artifact; no live MCP call)
sim add_tags tag_urns=[...] entity_urns=1 (demo artifact; no live MCP call)
```

Fix plan:

Rewrite offline demo job events in `frontend/src/lib/demoJob.ts` so simulated operations use `STATUS` plus `sim `. Keep `FIND`, `SCORE`, and `PR` where they represent artifact content rather than claimed live tool execution.

### 5. Frontend Trip Circuit Button Is Local-Only But Logs A Write

Severity: Medium

Status: confirmed by code inspection.

Why this is an issue:

The branch adds a visible `Trip circuit` action. In `App.tsx`, this action mutates local React state and emits a `WRITE` event, but it does not call the backend `/v1/jobs/{id}/trip` endpoint. The UI then claims a write-like action without a backend or MCP attempt.

Evidence in code:

- `frontend/src/App.tsx`: `onTripCircuit` updates local `job.quarantine`.
- `frontend/src/App.tsx`: `onTripCircuit` emits `kind: "WRITE"`.
- `frontend/src/lib/api.ts`: no `tripJob` API helper exists.
- `backend/api/routes.py`: `/v1/jobs/{job_id}/trip` exists and can be called.

Expected on this branch:

For API-backed jobs, `Trip circuit` should call backend `/v1/jobs/{id}/trip`, apply the returned artifact, and stream/log backend events. For demo-only jobs, it should log a `STATUS` line that clearly says it is local/simulated.

Fix plan:

Add `tripJob(jobId)` to `frontend/src/lib/api.ts`. Update `onTripCircuit`:

- if `source === "api"`, call backend and apply returned job;
- if offline demo, keep local mutation but log `STATUS` with `sim manual circuit trip ...`;
- never emit `WRITE` unless backend returns a real write event.

### 6. Audit Q&A Text Overstates What The Buttons Do

Severity: Medium

Status: confirmed by code inspection.

Why this is an issue:

`RagChat.tsx` says the `Trip Circuit` button applies official MCP tags and structured properties. Current button behavior is local-only in the frontend. The answer also uses lock/bolt icon characters in text, while the project generally aims for precise, non-fictional operational copy.

Evidence in code:

- `frontend/src/components/inspect/RagChat.tsx` says `Trip Circuit Button` applies official MCP tags and sets `midsphere.gate_status = BLOCKED`.
- Current `onTripCircuit` does not call backend or MCP.

Expected on this branch:

Q&A answers should describe the actual path:

- API-backed trip: calls backend trip endpoint, which may use live MCP only if configured.
- Offline/demo trip: local simulated state only.
- Consumer Gate enforcement remains MidSphere policy, not platform-wide MCP denial.

Fix plan:

Revise `RagChat.tsx` copy to be mode-aware based on `job.execution_mode`, `job.mutations_applied`, and frontend source behavior where available.

### 7. Job And Gate State Are Process-Local

Severity: Medium

Status: confirmed by code inspection.

Why this is an issue:

The backend stores jobs in module-level globals. That works for a local demo process, but Cloud Run can restart or run multiple instances. A job created on one instance may not be available to another instance, and gate decisions depend on `_LATEST`.

Evidence in code:

- `backend/api/routes.py` defines `_JOBS: dict[str, JobArtifact] = {}`.
- `backend/api/routes.py` defines `_LATEST: str | None = None`.
- `/v1/gate/{urn}` evaluates only `_JOBS.get(_LATEST)`.

Expected on this branch:

For demo mode, this is acceptable only if documented as process-local. For a stronger branch, persist job artifacts to a durable backend or make gate decisions read from DataHub advisory state when live mutations are enabled.

Fix plan:

Short-term:

- Document this clearly in backend README and health output.
- Add an explicit `storage: "process-local"` health field.

Better:

- Persist job artifacts in a small durable store.
- When live DataHub is reachable and mutations are enabled, let gate evaluate DataHub tags/properties rather than only `_LATEST`.

### 8. Antigravity Job Artifacts Always Report `datahub_reachable=false`

Severity: Medium

Status: confirmed by code inspection.

Why this is an issue:

The Antigravity runner returns `datahub_reachable=False` unconditionally. That can make a successful primary path report that DataHub is unreachable even if MCP was attached or GMS was reachable.

Evidence in code:

- `backend/agents/antigravity_runner.py` calls `builder.to_job(execution_mode="antigravity_closed_loop", datahub_reachable=False)`.

Expected on this branch:

The field should reflect an actual probe or known MCP/GMS status.

Fix plan:

Probe GMS before or during the Antigravity path using the existing `build_client_from_env().probe()` helper, then pass the actual result into `to_job`.

## Recommended Fix Order

1. Fix scenario contract reuse in `backend/agents/stage_tools.py`.
2. Add ecommerce and nyctaxi PR/MBOM example files.
3. Add backend tests for builder/fallback parity across healthcare, ecommerce, and nyctaxi.
4. Fix frontend demo telemetry to use honest `sim` status lines.
5. Wire `Trip circuit` to the backend for API-backed jobs and make demo-only trips clearly simulated.
6. Update `RagChat.tsx` copy to match actual behavior.
7. Add storage honesty to health/docs and decide whether durable storage is needed before merge.
8. Fix Antigravity `datahub_reachable` reporting.

## Acceptance Criteria Before Unifying

- `python -m pytest tests -q` passes with added scenario parity tests.
- `npm run build` passes.
- For all built-in scenarios, primary builder and fallback agree on:
  - risk score
  - quarantine target URNs
  - PR path
  - MBOM path
- Every emitted artifact path exists in git.
- Offline frontend demo contains no real-looking simulated `TOOL` / `WRITE` events.
- `Trip circuit` behavior is truthful for both API and demo modes.
