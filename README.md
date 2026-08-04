# MidSphere

```
   __  ___  _     _______       __
  /  |/  / (_)___/ / ___/____  / /_  ___  _______
 / /|_/ / / / __  /\__ \/ __ \/ __ \/ _ \/ ___/ _ \
/ /  / / / / /_/ /___/ / /_/ / / / /  __/ /  /  __/
/_/  /_/_/\__,_//____/ .___/_/ /_/\___/_/   \___/
                      /_/
```

### Autonomous Context Command & Circuit-Breaker Engine  
*Powered by [DataHub](https://datahub.com) · MCP · Antigravity · Gemini*

> Organizations ship AI agents faster than they ship trustworthy context.  
> When schema drift, bad quality, PII leaks, or orphan ownership hit the catalog, the failure does not stop at Slack.  
> **Context Entropy** sets in — and every agent still reading DataHub inherits the damage.

Traditional catalogs often act as **passive death certificates**: they log what broke, fire an alert that dies in scrollback, and leave Cursor, Claude, Analytics Agent, and Text-to-SQL bots hallucinating on corrupted metadata.

**MidSphere does not stop at the death certificate.**  
It **trips a circuit breaker inside DataHub’s context graph** — advisory quarantine, selective blast-radius halt, metadata-aware fix PRs, and a durable **Model Bill of Materials (MBOM)** so the next human *and* the next agent inherit permanent knowledge.

---

## The closed loop

| Stage | Agent | What happens |
| --- | --- | --- |
| **1. Audit** | `ContextSentinel` | Column lineage, quality, PII, ownership gates |
| **2. Topology** | `CascadeAnalyzer` | Blast-radius matrix + risk score 0–100 |
| **3. Break** | `CircuitBreaker` | Tags + structured properties (`gate_status=BLOCKED`) |
| **4. Fix** | `FixArchitect` | Golden SQL from DataHub → dbt/SQL PR |
| **5. Inherit** | `MBOMEngine` | Versioned attestation via `save_document` |

```
Trigger → Sentinel → Cascade → Breaker → Fix → MBOM
              │           │         │
              └──── DataHub MCP (read + mutation write-back) ────┘
```

**Honest circuit break (production-correct):**  
Quarantine is **advisory graph state** in DataHub (tags, structured properties, documents). MidSphere’s **Consumer Gate** enforces `BLOCKED` for MidSphere-aware clients. We do **not** claim that every third-party MCP consumer is auto-denied by the platform alone.

Primary demo: official **healthcare** forking pipeline — **selective halt** (billing vs demographics), not a naive “kill everything” switch.

---

## Why judges care

Built for **Build with DataHub: The Agent Hackathon**. Criteria are **equally weighted** — no score theater.

| Criterion | MidSphere angle |
| --- | --- |
| **Use of DataHub** | Bidirectional: lineage, schema, queries **in**; tags, structured properties, MBOM documents **out** |
| **Technical Execution** | E2E scan → quarantine → gate → PR → MBOM; claims match code |
| **Originality** | Closed-loop **mutation of the context graph** + selective halt — not a chat wrapper over search |
| **Real-World Usefulness** | Pipeline quality cascades, advisory quarantine, mergeable fixes, durable attestation |
| **Submission Quality** | Demo video, clear README, live UI, offline `examples/` |
| **Bonus OSS** | Skills: `datahub-circuit-breaker`, `datahub-quality-circuit` |

---

## Stack & isolation

| Surface | Stack | Deploy |
| --- | --- | --- |
| `frontend/` | React 18 · Vite · TypeScript · Deep Slate Command Center | **Vercel** (`midsphere`) |
| `backend/` | FastAPI · Antigravity · DataHub MCP · Gemini | **GCP Cloud Run** |
| Catalog | DataHub GMS + [MCP Server](https://github.com/acryldata/mcp-server-datahub) | Local quickstart / Cloud |

Never mix package trees. Never bake frontend into Cloud Run.

---

## Repository map

```
.
├── ARCHITECTURE.md     # System design & DataHub contracts
├── DESIGN.md           # Enterprise Mission Control UI
├── AGENTS.md           # Agent / MCP / ops bible
├── frontend/           # Command Center → Vercel
├── backend/            # Swarm engine → Cloud Run
├── skills/             # OSS skill drafts
├── examples/           # Judge-offline MBOMs, diffs, telemetry
├── scripts/            # Bootstrap + healthcare load helpers
├── LICENSE             # Apache-2.0
└── README.md           # You are here
```

Local-only (gitignored): `resource/` recon clones, Devpost rules dump, `.env`, deploy link state.

---

## Quick start

```bash
# Identity (once per clone)
git config user.name "adi-IL"
git config user.email "adi-IL@users.noreply.github.com"

cp .env.example .env
# set DATAHUB_GMS_URL, DATAHUB_GMS_TOKEN
# MCP process needs: TOOLS_IS_MUTATION_ENABLED=true

# Sample data (requires DataHub quickstart + local resource/datasets)
./scripts/load_healthcare.sh

# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

---

## MCP contracts (real names only)

**Read:** `search` · `get_entities` · `list_schema_fields` · `get_lineage` · `get_lineage_paths_between` · `get_dataset_queries`  

**Write** (`TOOLS_IS_MUTATION_ENABLED=true`): `add_tags` · `remove_tags` · `add_structured_properties` · `save_document`  

No inventing `datahub_*` prefixes. No MCP `create_incident` (Cloud GraphQL optional only).

---

## Docs for builders

1. [ARCHITECTURE.md](./ARCHITECTURE.md) — thesis, swarm, demo path  
2. [DESIGN.md](./DESIGN.md) — three-pane Mission Control  
3. [AGENTS.md](./AGENTS.md) — contracts you must not violate  

---

## License

[Apache License 2.0](./LICENSE)

---

*MidSphere — when context goes bad, trip the breaker. Don’t print another death certificate.*
