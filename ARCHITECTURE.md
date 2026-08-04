# MidSphere Architecture

**Autonomous Context Command & Circuit-Breaker Engine for the DataHub Context Platform**  
*Build with DataHub: The Agent Hackathon - universal redesign*

| Document | Role |
| --- | --- |
| **ARCHITECTURE.md** (this file) | Product thesis, system design, DataHub contracts, demo strategy |
| **DESIGN.md** | UI/UX, visual system, Command Center, demo artifacts |
| **AGENTS.md** | Agent contracts, MCP tool map, ops, verification, OSS skills |

**Design principle:** Every claim in these docs must map to a demable, judge-scorable behavior. Prefer production-correct contracts over aspirational language. Keep the punch - drop the fiction.

---

## 1. Why this product exists

### 1.1 Context Entropy (the enterprise context crisis)

Organizations ship hundreds of AI agents, copilots, and automated pipelines. Agents only behave as well as the **context** they receive-schemas, lineage, ownership, quality signals, query history, glossary definitions.

When that context is wrong, agents do not fail loudly. They:

- Generate SQL against drifted columns
- Train or score models on leaked / contaminated features
- Ignore PII and governance tags that never made it into the prompt
- Trust orphan datasets with no owner and no certification

This is **Context Entropy**: corruption in the metadata graph propagates silently into every consumer of that graph-humans *and* agents.

Existing governance tools too often act as **passive death certificates**-logging failures into a catalog or firing a Slack alert that dies in scrollback-while Cursor, Claude Code, and DataHub Analytics Agent **keep pulling dirty context** and making decisions on it.

**MidSphere’s breakthrough:** stop printing death certificates. **Trip the circuit breaker inside the context graph**, open a fix path, and leave a permanent MBOM so the next agent inherits safer knowledge.

### 1.2 Where DataHub sits

DataHub began at **LinkedIn** as a metadata platform for discovery and governance at scale, was open-sourced under **Apache 2.0** in 2020, and is now an independent community project under `datahub-project` / `datahub.com`. It has evolved from a catalog into an explicit **context platform for humans and AI agents**:

- **Context graph** - datasets, columns, pipelines, dashboards, ML models, documents, ownership, glossary, tags, structured properties, lineage (table + column)
- **Ingestion** - 100+ connectors into warehouses, lakes, BI, orchestration, ML platforms
- **Agent interfaces** - [MCP Server](https://docs.datahub.com/docs/features/feature-guides/mcp), [DataHub Skills](https://docs.datahub.com/docs/dev-guides/agent-context/skills), [Agent Context Kit](https://docs.datahub.com/docs/dev-guides/agent-context/agent-context), [Analytics Agent](https://github.com/datahub-project/analytics-agent)
- **Write paths** - GraphQL / SDK / CLI enrichment; MCP **mutation tools** (v0.5.0+, gated by `TOOLS_IS_MUTATION_ENABLED`)

DataHub powers stacks at companies such as Apple, Pinterest, Netflix, and thousands more. The hackathon thesis is correct: agents need this graph to do real work-and the graph must stay trustworthy when agents write back.

### 1.3 MidSphere one-liner

**MidSphere is a closed-loop multi-agent system that detects context-quality failures in DataHub, scores blast radius on lineage, mutates the graph with advisory quarantine state, opens fix PRs, and publishes durable MBOM attestations-so the next agent inherits safer context.**

It maps to three official challenge lanes at once:

1. **Agents That Do Real Work** - closed-loop multi-stage job with bidirectional graph I/O
2. **Metadata-Aware Code Generation** - FixArchitect produces mergeable dbt/SQL with golden queries from DataHub  
3. **Production ML Agents** - optional ML-leakage / feature-path audits on top of the same lineage spine  

Primary demo narrative (honest, dataset-native): **selective quality circuit-breaking** on the official **healthcare** sample pipeline.

---

## 2. What we keep from the junior design (and what we fix)

### 2.1 Keep

| Idea | Why it is strong |
| --- | --- |
| Context Entropy thesis | Real practitioner pain; aligns with DataHub’s “context platform” story |
| Five-agent closed loop | Clear specialization; demable pipeline with streaming telemetry |
| Bidirectional DataHub | Judging criterion *Use of DataHub* explicitly rewards write-back |
| Three-pane Command Center | Differentiates from chat-wrapper demos |
| Frontend / backend isolation | Vercel + Cloud Run, separate package trees |
| OSS skills bonus | Official bonus path via `datahub-project/datahub-skills` |
| Pre-baked `examples/` | Judges may score without running code |

### 2.2 Fix (critical)

| Junior claim | Production-correct stance |
| --- | --- |
| MCP tools named `datahub_get_lineage`, `datahub_add_tag`, `datahub_create_incident` | Real tools are **unprefixed**: `get_lineage`, `add_tags`, `save_document`, … **There is no MCP incident-create tool.** |
| Tags / `gate_status=BLOCKED` “dynamically block” all MCP consumers | MCP **mutates metadata only**. Search can filter tags/incidents; nothing auto-denies reads. Quarantine is **advisory graph state**. Optional MidSphere **Consumer Gate** honors that state. |
| `raiseIncident` via MCP on OSS quickstart | Incidents: **GraphQL** path; quality skill marks `raiseIncident` as **Cloud-only**. OSS success path = tags + structured properties + documents. Cloud = optional incident raise. |
| `datahub datapack load healthcare` with planted mlModel leakage | Official datapacks: `showcase-ecommerce`, `bootstrap`. Healthcare/nyc-taxi load via **ingest + lineage + metadata scripts**. Healthcare plants **quality issues** (negative billing, invalid ages, …)-ideal for selective halt, not target leakage. |
| Judging weights 25/20/20/20/15 and “scores 100%” | Stage Two criteria are **equally weighted**. Submissions need not be production-ready. Drop score theater. |
| Mutations always available | Default `TOOLS_IS_MUTATION_ENABLED=false`. Write-back demos require explicit enablement + tag/property bootstrap. |
| Skills as bare `SKILL.md` paths | Official skills need YAML frontmatter (`name`, `description`, `allowed-tools`, …), tier/approval language, and real tool contracts. |

---

## 3. System architecture

### 3.1 Logical view

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Triggers                                                                     │
│  Dashboard "Scan" · GitHub webhook · CI · Nightly cron · CLI                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ MidSphere Orchestrator (FastAPI · backend/)                                  │
│  · Job API · deterministic run_closed_loop stages · gate policy              │
│  · Optional Antigravity Gemini summary AFTER the closed loop                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ DataHub MCP   │       │ GitHub API      │       │ Optional        │
│ (stdio/HTTP)  │       │ branch + PR     │       │ GraphQL         │
│ reads+mutates │       │                 │       │ raiseIncident   │
└───────┬───────┘       └─────────────────┘       │ (Cloud only)    │
        │                                           └─────────────────┘
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ DataHub GMS (OSS quickstart or Cloud)                                        │
│  Lineage · Schema · Tags · Structured props · Documents · Ownership · Queries│
└─────────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ honor quarantine filters (optional)
┌─────────────────────────────────┴───────────────────────────────────────────┐
│ Consumers: Analytics Agent · Cursor/Claude via MCP · MidSphere Consumer Gate │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Physical deploy isolation (non-negotiable)

| Surface | Stack | Deploy target | Rule |
| --- | --- | --- | --- |
| `frontend/` | React 18 · Vite · TypeScript · Tailwind | **Vercel only** | No FastAPI, no agent SDK |
| `backend/` | Python 3.11+ · FastAPI · deterministic pipeline · optional Antigravity · MCP client | **GCP Cloud Run only** | No Vite tree, no frontend assets in image |
| DataHub | Docker quickstart (local) / Cloud tenant (optional) | Local or remote GMS | Backend talks GMS via MCP env |

Never mix package trees. Cloud Run images contain `backend/` only. Vercel deploys `frontend/` only.

### 3.3 Authentication & model routing

| Concern | Contract |
| --- | --- |
| Gemini / Vertex | Application Default Credentials via `gcloud auth application-default login` - **no hardcoded API keys** |
| DataHub MCP | `DATAHUB_GMS_URL` + `DATAHUB_GMS_TOKEN` (or `~/.datahubenv`) |
| Mutations | `TOOLS_IS_MUTATION_ENABLED=true` on the MCP server process MidSphere launches or connects to |
| Closed loop | Deterministic stages in `run_closed_loop` (not five separate LLM agents) |
| Optional summary | Antigravity + Vertex Gemini (`gemini-3.6-flash` default) after the loop |
| MCP | Official `mcp-server-datahub` via uvx stdio when `USE_OFFICIAL_MCP=true` |

Billing project and credit balances live in ops notes (AGENTS.md), not in architecture claims judges must trust.

---

## 4. Closed-loop stages (shipping)

The job path is a **single deterministic orchestrator** (`agents/pipeline.py` -> `run_closed_loop`), not five separate LLM agent processes. Stage names appear in telemetry for the Command Center. Each stage emits a typed artifact the next stage consumes.

Optional: after the loop finishes, `enrich_job_with_antigravity` may call Google Antigravity + Vertex Gemini (`gemini-3.6-flash` by default) for an operator summary. That is the only default LLM call on the shipping path. Stages themselves use **no per-stage model**.

```
POST /v1/jobs
    │
    ▼
run_closed_loop (deterministic)
    ContextSentinel  ──► AuditFinding[]
    CascadeAnalyzer  ──► BlastRadiusMatrix + RiskScore
    CircuitBreaker   ──► QuarantineReceipt (job-local; live MCP only if enabled+GMS)
    FixArchitect     ──► FixBundle (dry-run path or live PR when wired)
    MBOMEngine       ──► MBOM path / document URN
    │
    ▼
optional Antigravity summary (gemini-3.6-flash)
    │
    ▼
JobArtifact JSON + SSE/UI telemetry
```

Telemetry honesty: `TOOL` / `WRITE` only after a real MCP attempt. Offline demo steps use `STATUS` lines prefixed with `sim `.

### 4.1 ContextSentinel - auditor

| | |
| --- | --- |
| **Implementation** | Deterministic stage in `run_closed_loop` (no LLM) |
| **Role** | Detect quality / governance / (optional) ML-path anomalies on target entities |
| **MCP (read, when live)** | `search`, `get_entities`, `list_schema_fields`, `get_lineage`, `get_lineage_paths_between`, `get_dataset_queries` |
| **Outputs** | Structured `AuditFinding[]`: type, severity, evidence URNs, column paths, rationale |

**Finding types (v1, demo-aligned):**

| Type | Detection strategy | Primary demo asset |
| --- | --- | --- |
| `NEGATIVE_BILLING` | Profile / sample signals + schema context; flag billing columns with invalid range semantics | healthcare `raw_patients` → `mart_billing` |
| `INVALID_AGE` | Age domain checks against glossary/schema | healthcare demographics path |
| `DATE_SWAP` | Admission after discharge / negative length of stay | healthcare billing path |
| `PII_UNGOVERNED` | Columns with PII-like names lacking PII tags / glossary | any tagged pipeline |
| `ORPHAN_OWNER` | Entity missing owners / certification tags | ownership gate |
| `TARGET_LEAKAGE` *(optional extension)* | Short column-lineage path from label-like columns into feature sets of an `mlModel` | only if you **plant** an mlModel + leakage graph yourself |

Do **not** claim target leakage on stock healthcare packs-they do not include planted mlModel leakage.

### 4.2 CascadeAnalyzer - blast radius

| | |
| --- | --- |
| **Implementation** | Deterministic stage in `run_closed_loop` (no LLM) |
| **Role** | Expand downstream lineage; compute selective impact |
| **MCP (read, when live)** | `get_lineage` (downstream, multi-hop), `get_entities`, `search` |
| **Outputs** | `BlastRadiusMatrix`, `risk_score` ∈ [0, 100], per-node impact tags |

**Selective halt (healthcare story):**

```
raw_patients ──► staging_patients ──┬──► mart_billing        (hit by negative billing / date swap)
                                    └──► mart_demographics   (hit by invalid ages / NULL names)
```

A naive breaker quarantines everything. MidSphere’s analyzer recommends **only the affected fork** for quarantine-matching the dataset’s designed challenge.

**Risk score (transparent formula, not black-box theater):**

```
risk = clamp(0, 100,
    25 * severity_weight          # CRITICAL=1.0, HIGH=0.75, MED=0.5, LOW=0.25
  + 25 * min(1, downstream_count / 10)
  + 20 * has_pii                  # 0 or 1
  + 15 * has_production_env       # PROD / certified
  + 15 * missing_owner            # 0 or 1
)
```

Publish the formula in README so judges can audit it.

### 4.3 CircuitBreaker - graph mutator

| | |
| --- | --- |
| **Implementation** | Deterministic stage in `run_closed_loop` (no LLM) |
| **Role** | Apply **advisory** quarantine state on selected URNs |
| **MCP (write, when live)** | Requires official MCP + `TOOLS_IS_MUTATION_ENABLED=true` + reachable GMS |
| | `add_tags` / `remove_tags` |
| | `add_structured_properties` / `remove_structured_properties` |
| | Offline: job-local `QuarantineReceipt` only (`mutations_applied=false`) |
| | *(optional Cloud)* GraphQL `raiseIncident` outside MCP |
| **Outputs** | `QuarantineReceipt`: tags applied, properties set, incident URN if any, lift instructions |

**Canonical write-back (OSS-safe):**

1. Ensure tags exist (bootstrap via `datahub graphql` / CLI once at setup):  
   `urn:li:tag:QUARANTINED`, `urn:li:tag:CIRCUIT_BROKEN`, `urn:li:tag:MIDSPHERE_AUDIT`
2. `add_tags(tag_urns=[...], entity_urns=[affected...])`  
   Tags **must exist first** - MCP validates tag URNs.
3. Ensure structured property exists: e.g. `urn:li:structuredProperty:midsphere.gate_status` (string enum: `OPEN` | `BLOCKED` | `LIFTED`)
4. `add_structured_properties` with `gate_status=BLOCKED`, plus optional `midsphere.risk_score`, `midsphere.pr_url`
5. **Do not claim** that MCP consumers are auto-blocked. Document quarantine as **advisory**.
6. **Optional Consumer Gate** (MidSphere ships this): any MidSphere-aware client (and demo script) filters `tag:QUARANTINED` or `gate_status=BLOCKED` before using entity context-**this** is the demable circuit break.

**Cloud-only enhancement (never required for OSS pass):**

```graphql
mutation {
  raiseIncident(input: {
    type: OPERATIONAL
    title: "MidSphere quarantine: negative billing cascade"
    description: "..."
    resourceUrn: "<DATASET_URN>"
    priority: HIGH
    status: { state: ACTIVE, stage: TRIAGE }
  })
}
```

### 4.4 FixArchitect - metadata-aware code gen

| | |
| --- | --- |
| **Implementation** | Deterministic stage (shipping: dry-run fix path under `examples/prs/`) |
| **Role** | Produce mergeable fix artifacts grounded in catalog context |
| **MCP (read, when live)** | `get_dataset_queries`, `list_schema_fields`, `get_entities`, `get_lineage` |
| **External** | Optional GitHub API for real PRs when token present; else dry-run |
| **Outputs** | Diff bundle + PR URL or dry-run path |

**Grounding rules:**

- Prefer golden SQL from `get_dataset_queries` over inventing transforms
- Fix types for healthcare demo: filter negative billing, clamp ages, fix date order, add dbt tests / SQL assertions
- PR body includes AuditReport summary, blast radius, quarantine tags, link to MBOM (filled later)
- Put sample PR diffs in `examples/prs/` for offline judging

### 4.5 MBOMEngine - attestation publisher

| | |
| --- | --- |
| **Implementation** | Deterministic stage; live `save_document` only when official MCP mutations succeed |
| **Role** | Persist durable knowledge so future agents inherit the audit |
| **MCP (write, when live)** | `save_document` (mutations enabled + GMS up) |
| **Offline** | Job-local MBOM path under `examples/mboms/` with document URN placeholder |
| **Outputs** | Document URN and/or path + `related_assets` linking target datasets |

### 4.6 Optional Antigravity summary (only LLM on default path)

| | |
| --- | --- |
| **Implementation** | `agents/antigravity_runner.py` after `run_closed_loop` |
| **Summary model** | `gemini-3.6-flash` (default); fallbacks via `ANTIGRAVITY_MODELS` |
| **Not used for** | Sentinel, Cascade, Breaker, Fix, or MBOM stage logic (those are deterministic) |
| **When** | `ANTIGRAVITY_ENABLED=true` and Vertex ADC can reach the model |
| **On failure** | Job still succeeds; telemetry records unavailability; no fake summary |

**MBOM document contract:**

| Field | Value |
| --- | --- |
| `document_type` | `"Analysis"` or `"Insight"` |
| `title` | `MBOM: <entity display name> - MidSphere audit <ISO date>` |
| `content` | Markdown: findings, risk score, blast radius table, quarantine state, PR link, lift criteria |
| `topics` | `["midsphere", "circuit-breaker", "data-quality", ...]` |
| `related_assets` | Affected entity URNs |

Note: `save_document` creates a **standalone document** linked via `related_assets`, not a native aspect glued to an `mlModel` URN. That is sufficient and honest. Optional GraphQL `updateDocumentRelatedEntities` can refine links if needed.

---

## 5. DataHub integration matrix (judge-facing)

### 5.1 Read path (MCP)

| Tool | Used by | Purpose |
| --- | --- | --- |
| `search` | Sentinel, Cascade | Find entities, filter by tag/domain/platform |
| `get_entities` | All | Batch metadata hydrate |
| `list_schema_fields` | Sentinel, Fix | Schema / column inspection |
| `get_lineage` | Sentinel, Cascade | Upstream/downstream multi-hop |
| `get_lineage_paths_between` | Sentinel | Exact paths for leakage/quality fork analysis |
| `get_dataset_queries` | Fix, Sentinel | Golden SQL / usage patterns |
| `search_documents` / `grep_documents` | MBOM (optional) | Avoid duplicate MBOMs; learn prior audits |

### 5.2 Write path (MCP mutations)

| Tool | Used by | Requires |
| --- | --- | --- |
| `add_tags` / `remove_tags` | CircuitBreaker (lift) | Tags pre-created; `TOOLS_IS_MUTATION_ENABLED=true` |
| `add_structured_properties` / `remove_structured_properties` | CircuitBreaker | Property definitions pre-created |
| `save_document` | MBOMEngine | Mutations + document tools enabled |
| `update_description` | Optional enrichment | Mutations |

### 5.3 Non-MCP paths (explicit)

| Path | When |
| --- | --- |
| DataHub CLI ingest / `add_lineage.py` / `add_metadata.py` | Sample environment bootstrap |
| GraphQL `raiseIncident` | Cloud-only optional |
| GraphQL `createTag` / structured property create | One-time bootstrap |
| GitHub REST | PRs |

### 5.4 What we deliberately do **not** claim

- That MCP auto-blocks quarantined entities for third-party agents  
- That OSS quickstart supports Cloud-only quality mutations as first-class  
- That stock healthcare includes mlModel target leakage  
- Fabricated judging percentage weights  
- “Production-grade / scores 100%” rhetoric  

---

## 6. Consumer Gate (honest circuit break)

To make “circuit breaker” **true without lying about the platform**:

```
┌──────────────────┐     honors      ┌────────────────────────────┐
│ MidSphere Gate   │◄────────────────│ gate_status=BLOCKED OR     │
│ (backend filter) │                 │ tag:QUARANTINED            │
└────────┬─────────┘                 └────────────────────────────┘
         │ filter context bundle
         ▼
  Agent / SQL gen / demo client receives redacted or blocked context
  + reason code + PR link + lift instructions
```

**Demo script (judge-visible):**

1. Run scan → quarantine `mart_billing`  
2. Call MidSphere “context for entity” API → returns `BLOCKED` with audit summary  
3. Show DataHub UI: tags + structured props + MBOM document  
4. Lift quarantine after PR merge simulation → context returns `OPEN`

Optional: document how Analytics Agent or Cursor users can add a search filter `NOT tag:QUARANTINED`-search supports tag filters; this is configuration, not magic enforcement.

---

## 7. Sample data & verification strategy

### 7.1 Primary demo pack: healthcare

```bash
# DataHub OSS quickstart running
cd resource/repositories/static-assets/datasets/healthcare
datahub ingest -c ingest.yaml
python add_lineage.py
python add_metadata.py
```

Planted issues (always present, seed 42):

| Issue | ~Impact | Selective effect |
| --- | --- | --- |
| Negative billing | ~2% rows | `mart_billing` |
| NULL names | ~1% | `mart_demographics` |
| Invalid ages | ~1.5% | `mart_demographics` |
| Date swaps | ~0.5% | `mart_billing` |

### 7.2 Secondary: nyc-taxi (freshness / staleness)

Use when demoing pipeline lag detection (staging 3 days behind raw). Load path is script-based, not `datapack load`.

### 7.3 Showcase datapack (breadth)

```bash
datahub datapack load showcase-ecommerce   # or bootstrap
```

Useful for multi-platform lineage demos (Snowflake, Looker, dbt, …). Not required for the core healthcare loop.

### 7.4 End-to-end pass criteria

| Step | Pass signal |
| --- | --- |
| MCP smoke | `smoke_check.py` and `smoke_check.py --mutations` green against GMS |
| Sentinel | ≥1 finding on healthcare raw/staging with evidence |
| Cascade | Downstream matrix shows selective fork impact |
| Breaker | Tags + structured props visible in DataHub UI / `get_entities` |
| Gate | MidSphere context API returns BLOCKED for quarantined URN |
| Fix | PR opened (or dry-run diff in `examples/` if GitHub token absent) |
| MBOM | Document searchable; `related_assets` include target URN |
| Lift | `remove_tags` + property update restores OPEN |

---

## 8. OSS skills (bonus prize path)

Two skills, structured like official `datahub-skills` entries:

### `datahub-circuit-breaker`

- **Triggers:** quarantine, lift quarantine, gate status, circuit break  
- **Tools:** MCP read + mutation tags/properties; CLI fallback  
- **Gates:** Always show plan; require approval before writes; tier-check for incidents  

### `datahub-ml-audit` *(or `datahub-quality-circuit` if ML path is not planted)*

- Prefer naming that matches **what you actually ship**  
- If demo is quality-selective-halt: skill can be `datahub-quality-circuit`  
- If you plant mlModel leakage: keep `datahub-ml-audit` for column-lineage leakage + MBOM  

Skill YAML frontmatter pattern (mirror official skills):

```yaml
---
name: datahub-circuit-breaker
description: |
  Use when quarantining assets, checking gate status, lifting circuit breaks,
  or applying MidSphere-style advisory blocks in DataHub.
user-invocable: true
min-cli-version: 1.4.0
allowed-tools: Bash(datahub *)
---
```

Contribute via PR to `datahub-project/datahub-skills` with Conventional Commits.

---

## 9. Judging alignment (equal weights)

| Criterion | How MidSphere earns it |
| --- | --- |
| **Use of DataHub** | Deep read (lineage, schema, queries, ownership) + real write-back (tags, structured properties, documents). MCP is the primary agent interface. |
| **Technical Execution** | E2E works: scan → quarantine → gate → PR → MBOM. Claims match code. Mutations smoke-tested. |
| **Originality** | Active closed-loop **mutation of the context graph** + selective halt + consumer gate-not a chat UI over search. Composes shipped MCP/skills; does not reimplement the catalog. |
| **Real-World Usefulness** | Selective pipeline halt, PII/orphan gates, fix PR + durable attestation-problems platform teams face. Explicitly **not** required to be production-hardened. |
| **Submission Quality** | &lt;3 min video, live demo or clear setup, Apache 2.0 repo, README that states what/why/how, `examples/` offline artifacts. |
| **Bonus OSS** | Two skills with proper structure + optional fixes/docs PR. |

---

## 10. Repo layout (target)

```
midsphere/   # or repo root
├── frontend/                 # React 18 + Vite + TS → Vercel
├── backend/                  # FastAPI + deterministic pipeline + optional Antigravity + MCP → Cloud Run
│   ├── agents/               # five agent modules + typed artifacts
│   ├── gate/                 # consumer gate
│   ├── mcp/                  # MCP client wrapper
│   └── api/                  # REST + SSE
├── skills/                   # OSS contribution drafts
│   ├── datahub-circuit-breaker/
│   └── datahub-ml-audit/     # or datahub-quality-circuit
├── examples/                 # judge offline: MBOMs, PR diffs, screenshots
├── scripts/                  # bootstrap tags/properties, healthcare load
├──                  # architecture redesign (this doc set)
├── AGENTS.md                 # ops contracts
├── LICENSE                   # Apache-2.0
└── README.md                 # judge-facing
```

---

## 11. Delivery roadmap (compressed, claim-safe)

| Phase | Focus | Exit criteria |
| --- | --- | --- |
| **P1** | DataHub quickstart + healthcare ingest + tag/property bootstrap | Entities + lineage visible; mutation smoke passes |
| **P2** | Orchestrator + Sentinel + Cascade | AuditReport + BlastRadius on healthcare |
| **P3** | CircuitBreaker + Consumer Gate + MBOM | Tags/props/doc in graph; gate returns BLOCKED |
| **P4** | FixArchitect + GitHub PR + frontend Command Center | Live swarm UI; PR or dry-run examples |
| **P5** | Skills PR, video, `examples/`, Devpost | Submission checklist complete |

---

## 12. Tech stack reference (SDKs & libs)

| Layer | Library / service | Notes |
| --- | --- | --- |
| Closed loop | `agents/pipeline.py` `run_closed_loop` | Deterministic stages; no per-stage LLM |
| Optional LLM summary | `google-antigravity` + Vertex Gemini | Default `gemini-3.6-flash` after the loop; see `antigravity_runner.py` |
| API | FastAPI | Jobs, gate, health |
| MCP | Official `mcp-server-datahub` via `uvx` stdio | `midsphere_mcp/official.py`; mutations opt-in |
| GMS probe | httpx | Reachability helper in `midsphere_mcp/client.py` |
| Frontend | React 18, Vite, TypeScript, Tailwind, React Flow, Geist | See DESIGN.md (monochrome Command Center) |
| Deploy | Vercel (frontend), Cloud Run (backend) | Strict isolation |

---

## 13. Document history

| Version | Notes |
| --- | --- |
| Legacy junior blueprint / init | Strong thesis; incorrect MCP/incident/datapack/judging details |
| **ARCHITECTURE.md (this file)** | Aligned with shipping deterministic orchestrator + optional Gemini summary; selective healthcare demo; advisory quarantine + Consumer Gate |

---

*MidSphere - Architecture. Claims are contracts. Contracts must demo.*
