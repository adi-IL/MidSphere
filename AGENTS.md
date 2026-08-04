# AGENTS.md - MidSphere Operations & Agent Contracts

**Autonomous Context Circuit-Breaker - agent, MCP, deploy, and verification bible**  
*universal redesign · supersedes junior `init.md` and `.agents/rules` for implementation*

| Document | Role |
| --- | --- |
| ARCHITECTURE.md | Product thesis, system design |
| DESIGN.md | UI/UX source of truth |
| **AGENTS.md** (this file) | What agents may do, real tool contracts, ops, tests |

```
   __  ___  _     _______       __
  /  |/  / (_)___/ / ___/____  / /_  ___  _______
 / /|_/ / / / __  /\__ \/ __ \/ __ \/ _ \/ ___/ _ \
/ /  / / / / /_/ /___/ / /_/ / / / /  __/ /  /  __/
/_/  /_/_/\__,_//____/ .___/_/ /_/\___/_/   \___/
                      /_/
```

> Read ARCHITECTURE.md + DESIGN.md before writing code.  
> This file is the **contract**. If code contradicts this file, the code is wrong-or update this file first.

---

## 0. Hard mandates

### 0.1 First-principles context

DataHub’s context graph is the system of record for MidSphere. Agents do not invent warehouse schemas when MCP can return them. Prefer:

`search` → `get_entities` → `list_schema_fields` → `get_lineage` → `get_dataset_queries`

### 0.2 Closed-loop write-back

An audit is incomplete until advisory state is written back **when mutations are enabled**:

1. Tags (`QUARANTINED`, `CIRCUIT_BROKEN`, `MIDSPHERE_AUDIT`)  
2. Structured properties (`midsphere.gate_status`, risk, PR URL)  
3. MBOM via `save_document` + `related_assets`  
4. Optional Cloud incident via GraphQL (never required for OSS pass)

If mutations are disabled, run **audit-only** mode and label the job as such-do not fake write success.

### 0.3 Non-destructive circuit breaking

- Never drop tables, delete warehouse data, or hard-delete DataHub entities  
- Quarantine is reversible: Lift removes tags / sets `gate_status=LIFTED`  
- Every trip links to audit id + PR (or dry-run patch path)

### 0.4 No enforcement fiction

**Forbidden claims in code comments, UI copy, README, or skills:**

- “MCP blocks all agents from reading quarantined entities”  
- “DataHub automatically denies tools for BLOCKED assets”  

**Allowed claims:**

- “MidSphere writes advisory quarantine metadata to DataHub”  
- “MidSphere Consumer Gate refuses context for BLOCKED entities”  
- “Clients may filter `tag:QUARANTINED` in search”

### 0.5 Honest tool names

Use **exact** MCP tool names from `mcp-server-datahub`. Never invent `datahub_*` prefixes.

---

## 1. Swarm pipeline contract

### 1.1 Order (strict)

```
ContextSentinel → CascadeAnalyzer → CircuitBreaker → FixArchitect → MBOMEngine
```

Optional short-circuit:

- No findings → skip Breaker/Fix/MBOM; emit clean report  
- `dry_run=true` → run Sentinel+Cascade only  
- `auto_trip=false` → require human “Trip Circuit” before Breaker  

### 1.2 Shared job artifact

```json
{
  "job_id": "uuid",
  "root_urn": "urn:li:dataset:...",
  "mode": "full | dry_run | audit_only",
  "status": "queued|running|succeeded|failed",
  "findings": [],
  "blast_radius": { "nodes": [], "risk_score": 0 },
  "quarantine": null,
  "pr": null,
  "mbom": null,
  "events": []
}
```

Persist under `backend` job store; stream `events` over SSE.

---

## 2. Agent definitions

### 2.1 ContextSentinel

| Field | Value |
| --- | --- |
| Model | `gemini-3.6-flash` |
| Framework | Antigravity `Agent` + `LocalAgentConfig` |
| MCP tools (read) | `search`, `get_entities`, `list_schema_fields`, `get_lineage`, `get_lineage_paths_between`, `get_dataset_queries` |
| Writes | None |

**Must:**

- Prefer column-level lineage when investigating field issues  
- Emit typed findings with severity + evidence (not free text only)  
- For healthcare demo: detect negative billing, invalid ages, date swaps, NULL-like name issues using catalog + rules (and optional SQL samples if connector available)  
- Flag missing owners / missing PII tags when tags exist in catalog  

**Must not:**

- Claim mlModel target leakage unless an mlModel + planted path exists in the instance  
- Call mutation tools  

**Finding schema:**

```python
class AuditFinding(BaseModel):
    id: str
    type: Literal[
        "NEGATIVE_BILLING",
        "INVALID_AGE",
        "DATE_SWAP",
        "NULL_PII_FIELD",
        "PII_UNGOVERNED",
        "ORPHAN_OWNER",
        "TARGET_LEAKAGE",  # optional extension only
        "SCHEMA_DRIFT",
        "OTHER",
    ]
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    entity_urn: str
    column_path: str | None = None
    evidence: str
    rationale: str
```

---

### 2.2 CascadeAnalyzer

| Field | Value |
| --- | --- |
| Model | `gemini-3.6-flash` |
| MCP tools | `get_lineage` (downstream), `get_entities`, `search` |
| Writes | None |

**Must:**

- Expand downstream with explicit `max_hops` (default 2-3; confirm if larger)  
- Mark **selective impact** per finding type (billing issues ↛ demographics-only nodes)  
- Compute `risk_score` with the published formula (ARCHITECTURE §4.2)  
- Output `BlastRadiusMatrix` with hop, impacted bool, reason  

**Must not:**

- Quarantine entities itself  

---

### 2.3 CircuitBreaker

| Field | Value |
| --- | --- |
| Model | `gemini-3.6-flash` |
| MCP tools (write) | `add_tags`, `remove_tags`, `add_structured_properties`, `remove_structured_properties` |
| Optional | GraphQL `raiseIncident` **only if** `DATAHUB_TIER=cloud` and feature flag on |
| Env | MCP server must have `TOOLS_IS_MUTATION_ENABLED=true` |

**Must:**

1. Verify tags exist (bootstrap script if missing)-`add_tags` **fails** if tag URN missing  
2. Apply tags only to **impacted** URNs from Cascade (selective)  
3. Set structured properties:  
   - `midsphere.gate_status` = `BLOCKED`  
   - `midsphere.risk_score` = number  
   - `midsphere.job_id` = string  
4. Emit `QuarantineReceipt`  
5. Support `lift_quarantine(urns)` → `remove_tags` + `gate_status=LIFTED`  

**Must not:**

- Call non-existent `create_incident` MCP tool  
- Assert global MCP read denial  
- Trip non-impacted fork nodes “to be safe” without user override  

**MCP call shapes (authoritative):**

```python
# Tags - tags must already exist
add_tags(
    tag_urns=[
        "urn:li:tag:QUARANTINED",
        "urn:li:tag:CIRCUIT_BROKEN",
        "urn:li:tag:MIDSPHERE_AUDIT",
    ],
    entity_urns=["urn:li:dataset:(...)"],
    # column_paths optional for field-level
)

remove_tags(tag_urns=[...], entity_urns=[...])

# Structured properties - property defs must already exist
add_structured_properties(
    # follow live tool schema from MCP; values typed per property definition
)
```

Bootstrap (one-time, CLI/GraphQL-not MCP):

```bash
# Create tags (example - use datahub graphql / SDK)
# createTag for QUARANTINED, CIRCUIT_BROKEN, MIDSPHERE_AUDIT
# Create structured properties midsphere.gate_status, midsphere.risk_score, midsphere.job_id, midsphere.pr_url
python scripts/bootstrap_midsphere_metadata.py
```

---

### 2.4 FixArchitect

| Field | Value |
| --- | --- |
| Model | `gemini-3.1-pro-preview` |
| MCP tools | `get_dataset_queries`, `list_schema_fields`, `get_entities`, `get_lineage` |
| External | GitHub API |

**Must:**

- Ground SQL/dbt on `get_dataset_queries` + schema  
- Produce file-level diffs suitable for PR  
- PR body includes findings, risk, quarantine tags, job id  
- If no `GITHUB_TOKEN`: write `examples/prs/<job_id>.diff` and mark `pr.status=dry_run`  

**Must not:**

- Commit generated code without branch isolation  
- Force-push  

**Git identity (repo config):**

```bash
git config user.name "adi-IL"
git config user.email "adi-IL@users.noreply.github.com"
```

---

### 2.5 MBOMEngine

| Field | Value |
| --- | --- |
| Model | `gemini-3.1-pro-preview` |
| MCP tools | `save_document`, optionally `search_documents` |
| Env | Mutations enabled; `SAVE_DOCUMENT_TOOL_ENABLED` not false |

**Must:**

- Build markdown MBOM from job artifact  
- Call `save_document` with:  
  - `document_type`: `"Analysis"` or `"Insight"`  
  - `title`: clear, dated  
  - `content`: full markdown  
  - `topics`: `["midsphere", "circuit-breaker", "data-quality"]`  
  - `related_assets`: impacted URNs  
- Record returned document URN on job  
- Prefer confirmation semantics in autonomous mode: orchestrator pre-approves MBOM publish as part of job policy (UI toggle **Publish MBOM**)  

**Must not:**

- Pretend the document is a native mlModel aspect if only `related_assets` link exists  
- Overwrite arbitrary user docs (respect `SAVE_DOCUMENT_RESTRICT_UPDATES`)  

```python
save_document(
    document_type="Analysis",
    title="MBOM: mart_billing - MidSphere audit 2026-08-03",
    content="## Summary\n...",
    topics=["midsphere", "circuit-breaker", "data-quality"],
    related_assets=["urn:li:dataset:(...)"],
)
```

---

## 3. Consumer Gate

Module: `backend/gate/`

```python
def evaluate_context(entity_urn: str) -> GateDecision:
    """
    OPEN    - no quarantine tags / gate_status not BLOCKED
    BLOCKED - tag QUARANTINED or CIRCUIT_BROKEN or gate_status=BLOCKED
    LIFTED  - explicit LIFTED after remediation
    """
```

API:

- `GET /v1/gate/{urn}` → decision + reason + job_id + pr_url + mbom_urn  
- Used by demo + any MidSphere-aware agent  

This is the **only** place we enforce a hard block. Document it as MidSphere policy, not DataHub core behavior.

---

## 4. MCP server configuration

### 4.1 Process MidSphere should run or connect to

```bash
export DATAHUB_GMS_URL="http://localhost:8080"
export DATAHUB_GMS_TOKEN="<token>"
export TOOLS_IS_MUTATION_ENABLED=true
export SAVE_DOCUMENT_TOOL_ENABLED=true
# optional:
# export TOOLS_IS_USER_ENABLED=true

uvx mcp-server-datahub@latest
# or: uv run mcp-server-datahub --transport http
```

### 4.2 Tool inventory MidSphere uses

**Read (always):**

| Tool | Purpose |
| --- | --- |
| `search` | Discovery, tag filters |
| `get_entities` | Batch hydrate |
| `list_schema_fields` | Columns |
| `get_lineage` | up/down, hops, column |
| `get_lineage_paths_between` | Exact paths |
| `get_dataset_queries` | Golden SQL |
| `search_documents` | Prior MBOMs |

**Write (mutations on):**

| Tool | Purpose |
| --- | --- |
| `add_tags` / `remove_tags` | Quarantine / lift |
| `add_structured_properties` / `remove_structured_properties` | Gate + scores |
| `save_document` | MBOM |
| `update_description` | Optional |

**Not available as MCP tools (do not call):**

- `create_incident` / `datahub_create_incident`  
- `datahub_get_lineage` (wrong name)  
- `datahub_add_tag` (wrong name; real is `add_tags`)  

### 4.3 Smoke checks (mandatory before demo)

From `resource/repositories/mcp-server-datahub`:

```bash
uv run python scripts/smoke_check.py              # read-only
uv run python scripts/smoke_check.py --mutations  # add/remove pairs
```

MidSphere CI should fail if mutation smoke fails while `REQUIRE_MUTATIONS=1`.

### 4.4 Version floors (from tool decorators)

Many mutation tools declare `@min_version(cloud="0.3.16", oss="1.4.0")`. Target GMS ≥ OSS 1.4.x for write-back demos.

---

## 5. Antigravity SDK usage

Reference: `.agents/sdk.md`

```python
from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

config = LocalAgentConfig(
    system_instructions=SENTINEL_SYSTEM_PROMPT,
    capabilities=CapabilitiesConfig(),  # enable tools as needed
)

async with Agent(config) as agent:
    response = await agent.chat(prompt)
    async for token in response:
        ...
    async for thought in response.thoughts:
        emit_event("STATUS", thought)
    async for call in response.tool_calls:
        emit_event("TOOL", f"{call.name} {call.args}")
```

**Routing:**

| Agents | Model |
| --- | --- |
| Sentinel, Cascade, Breaker | `gemini-3.6-flash` |
| Fix, MBOM | `gemini-3.1-pro-preview` |

**Auth:** ADC only - `gcloud auth application-default login`. Never commit keys.

**Ops notes (local):**

- Billed GCP project: `project-dace7531-ac79-4f81-bd2` (see operator env; not required in public README)  
- Prefer global region endpoints for Gemini as configured in project  

---

## 6. Backend API surface (minimal)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/jobs` | Start scan `{ root_urn, mode, auto_trip }` |
| `GET` | `/v1/jobs/{id}` | Job artifact |
| `GET` | `/v1/jobs/{id}/stream` | SSE `JobEvent` |
| `POST` | `/v1/jobs/{id}/trip` | Manual circuit trip |
| `POST` | `/v1/jobs/{id}/lift` | Lift quarantine |
| `GET` | `/v1/gate/{urn}` | Consumer Gate |
| `GET` | `/v1/health` | DataHub + MCP reachability |

CORS: allow Vercel frontend origin only in prod.

---

## 7. Deploy isolation

| Directory | Deploy | Forbidden |
| --- | --- | --- |
| `frontend/` | `vercel` / `vercel --prod` from that dir | Backend code, secrets for GMS in client |
| `backend/` | Cloud Run container from backend Dockerfile | Frontend `node_modules`, Vite |

Vercel CLI is pre-authenticated in the operator environment; still never bake DataHub tokens into the frontend bundle. Frontend talks only to MidSphere backend.

---

## 8. Sample data setup (correct paths)

### 8.1 Healthcare (primary)

```bash
# DataHub quickstart already up
pip install 'acryl-datahub[sqlalchemy,datahub-rest]'
cd resource/repositories/static-assets/datasets/healthcare
datahub ingest -c ingest.yaml
python add_lineage.py
python add_metadata.py
python ../../../../scripts/bootstrap_midsphere_metadata.py  # tags + structured props
```

### 8.2 Datapacks (breadth only)

```bash
datahub datapack load bootstrap
# or
datahub datapack load showcase-ecommerce
```

### 8.3 Do not document

```bash
# WRONG - healthcare is not a datapack with mlModel leakage
datahub datapack load healthcare
```

---

## 9. OSS skills contribution

### 9.1 Layout

```
skills/
  datahub-circuit-breaker/
    SKILL.md
    references/
    templates/
  datahub-quality-circuit/   # preferred name if ML leakage not shipped
    SKILL.md
    ...
```

### 9.2 Frontmatter template

```yaml
---
name: datahub-circuit-breaker
description: |
  Use this skill when the user wants to quarantine DataHub assets, check
  MidSphere-style gate status, lift circuit breaks, or apply advisory
  quarantine tags and structured properties. Triggers on: "quarantine",
  "circuit breaker", "lift quarantine", "gate status", "block this table".
user-invocable: true
min-cli-version: 1.4.0
allowed-tools: Bash(datahub *)
---
```

### 9.3 Skill behavior rules (mirror official skills)

1. Resolve entities (search → confirm URN)  
2. Show current tags / properties  
3. **Approval before writes**  
4. Prefer MCP mutations when available; else `datahub graphql`  
5. Tier-check: incidents Cloud-only  
6. Verify with re-read  
7. Conventional Commits on PR to `datahub-project/datahub-skills`  

### 9.4 Naming honesty

| If you ship | Skill name |
| --- | --- |
| Quality selective halt + tags/MBOM | `datahub-quality-circuit` + `datahub-circuit-breaker` |
| Planted mlModel leakage path | add `datahub-ml-audit` |

Do not open a skill PR that documents tools DataHub does not expose.

---

## 10. Verification checklist

### 10.1 Pre-demo

- [ ] DataHub GMS healthy  
- [ ] Healthcare ingested + lineage + metadata  
- [ ] Bootstrap tags + structured properties exist  
- [ ] MCP smoke read + mutations pass  
- [ ] `TOOLS_IS_MUTATION_ENABLED=true` on MCP used by backend  
- [ ] ADC works for Gemini (`gcloud` user logged in)  
- [ ] Frontend on Vercel or local Vite; backend on Cloud Run or local uvicorn  

### 10.2 E2E job

- [ ] Sentinel ≥1 finding on healthcare  
- [ ] Cascade selective impact (billing vs demographics)  
- [ ] Tags visible on impacted URNs in DataHub UI  
- [ ] `gate_status=BLOCKED` readable via `get_entities` / gate API  
- [ ] Gate API returns BLOCKED  
- [ ] Fix diff produced; PR or dry-run file  
- [ ] MBOM document searchable; related_assets set  
- [ ] Lift restores OPEN  

### 10.3 Submission

- [ ] Apache 2.0 `LICENSE` at repo root  
- [ ] Public GitHub repo  
- [ ] README: what / why / how to run  
- [ ] Video &lt; 3 minutes, public  
- [ ] Live demo URL or clear setup  
- [ ] `examples/` populated  
- [ ] Claims in README match implemented paths  
- [ ] Judging language uses **equal weights**, no fake %  

---

## 11. UI / implementation alignment (agents writing frontend)

Before UI work:

1. Read **DESIGN.md** completely (Deep Slate tokens, three-pane, real tool names in telemetry)  
2. Do not implement pure-black zinc palette from junior init  
3. Telemetry must show `get_lineage` / `add_tags` / `save_document`  

---

## 12. Security & safety

- Strip shell metacharacters from any CLI-wrapped URN/query paths  
- Treat user-provided descriptions/tags as untrusted (skill + agent)  
- No destructive SQL in FixArchitect suggestions (`DROP`/`DELETE`/`TRUNCATE` require human override flag)  
- Secrets only in env / secret manager - never in git  
- Service account recommended for unattended Cloud Run → DataHub  

---

## 13. Roadmap mapping (implementation phases)

| Phase | Agents / systems | Done when |
| --- | --- | --- |
| P1 | Bootstrap + MCP client | Mutation smoke green on healthcare |
| P2 | Sentinel + Cascade + job API | Findings + blast JSON stable |
| P3 | Breaker + Gate + MBOM | Graph write-back + gate BLOCKED |
| P4 | FixArchitect + frontend | PR/diff + Command Center live |
| P5 | Skills + examples + video | Devpost-ready |

---

## 14. Changelog vs junior docs

| Topic | Junior (legacy) | This repo |
| --- | --- | --- |
| MCP names | `datahub_*` | Real unprefixed tools |
| Incidents | Always via MCP | Optional GraphQL Cloud-only |
| Blocking | “Dynamic MCP block” | Advisory metadata + Consumer Gate |
| Sample data | datapack + leakage | healthcare ingest + quality issues |
| Judging | Weighted % theater | Equal criteria, claim honesty |
| Skills | Path-only | Frontmatter + approval + tier |
| Mutations | Implicit | Explicit env + bootstrap |
| UI palette | Black zinc vs Deep Slate conflict | DESIGN.md Deep Slate sole authority |

---

## 15. Quick operator cheat sheet

```bash
# Auth
gcloud auth application-default login

# DataHub + healthcare
datahub docker quickstart   # or existing GMS
# ingest healthcare (see §8)

# MCP with writes
export DATAHUB_GMS_URL=... DATAHUB_GMS_TOKEN=... TOOLS_IS_MUTATION_ENABLED=true

# Backend
cd backend && uvicorn app.main:app --reload

# Frontend
cd frontend && npm run dev
# deploy: vercel --prod
```

---

*MidSphere - AGENTS.md. Contracts over slogans. Real MCP. Reversible quarantine. Demo truth.*
