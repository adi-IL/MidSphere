# examples/

Scenario artifacts aligned with `backend/agents/scenarios.py` and Command Center fixtures in `frontend/src/lib/demoJob.ts`.

These files are the **dry-run / offline** outputs of the closed loop. They are not live warehouse extracts. Live jobs may write tags or documents to GMS when mutations are enabled; the paths below remain the canonical dry-run references.

| Path | Content |
| --- | --- |
| [`mboms/`](mboms/) | MBOM markdown per scenario |
| [`prs/`](prs/) | Dry-run fix diffs (dbt/SQL style) |
| [`jobs/`](jobs/) | Healthcare job JSON fixture (`demo_closed_loop`) |
| [`telemetry/`](telemetry/) | Sample stage log with real MCP tool names and simulated labels |

## Scenario table (source of truth: `scenarios.py`)

| Scenario | Risk | Quarantine target | Open fork | Fix path | MBOM path |
| --- | --- | --- | --- | --- | --- |
| Healthcare | 61 | `mart_billing` | `mart_demographics` | `prs/fix-negative-billing.example.diff` | `mboms/healthcare-billing-mbom.example.md` |
| Ecommerce | 88 | `mart_customer_360` | `mart_product_catalog` | `prs/fix-pii-masking.example.diff` | `mboms/ecommerce-pii-mbom.example.md` |
| NYC Taxi | 65 | `mart_monthly_revenue` | `mart_trip_distance_stats` | `prs/fix-taxi-freshness.example.diff` | `mboms/nyctaxi-revenue-mbom.example.md` |

### Healthcare tags

`QUARANTINED`, `CIRCUIT_BROKEN`, `MIDSPHERE_AUDIT`

### Ecommerce tags

`PII_LEAK`, `QUARANTINED`, `MIDSPHERE_AUDIT`

### NYC Taxi tags

`PIPELINE_LAG`, `QUARANTINED`, `MIDSPHERE_AUDIT`

## Honesty

| Mode | Behavior |
| --- | --- |
| Sample / offline | Job-local quarantine; simulated telemetry (`sim` / Simulated); Pipeline badge **Sample** |
| GMS up, mutations on | Job may set `mutations_applied=true`; telemetry may show `official_mcp ok` for real tool names |
| Execution modes | `antigravity_closed_loop`, `demo_closed_loop`, `live_mcp` |

MCP names are unprefixed official tools only (`get_lineage`, `add_tags`, `save_document`, and the allowlist in architecture docs).

Live catalog operations: [scripts/README.md](../scripts/README.md).
