# examples/

Judge-scorable artifacts that stand alone **without running the app**.

| Path | Content |
| --- | --- |
| `mboms/` | Healthcare, ecommerce, NYC taxi MBOM markdown |
| `prs/` | Sample fix diffs (dbt/SQL) per scenario |
| `jobs/` | Offline job JSON fixture |
| `telemetry/` | Sample swarm log lines (real MCP names) |
| `ui/` | Optional UI capture folder |

## Scenario risk scores (closed-loop defaults)

| Scenario | Risk | Quarantine target | Fix path | MBOM path |
| --- | --- | --- | --- | --- |
| Healthcare | **61** | `mart_billing` | `prs/fix-negative-billing.example.diff` | `mboms/healthcare-billing-mbom.example.md` |
| Ecommerce | **88** | `mart_customer_360` | `prs/fix-pii-masking.example.diff` | `mboms/ecommerce-pii-mbom.example.md` |
| NYC Taxi | **65** | `mart_monthly_revenue` | `prs/fix-taxi-freshness.example.diff` | `mboms/nyctaxi-revenue-mbom.example.md` |

These match `backend/agents/scenarios.py`. Selective halt leaves one open fork in each graph.

## Honesty

- Offline demos use **job-local** quarantine and `sim` telemetry when GMS is unreachable.
- Example MBOMs describe the **intended** write-back contract; they are **not** proof that tags were written to a live catalog.
- Live MCP names are unprefixed (`get_lineage`, `add_tags`, `save_document`, …).
- `execution_mode` ground truth: `antigravity_closed_loop` | `demo_closed_loop` | `live_mcp`.
- Mutations only when GMS is reachable **and** `TOOLS_IS_MUTATION_ENABLED=true`.

Command Center offline fixtures: `frontend/src/lib/demoJob.ts`.
