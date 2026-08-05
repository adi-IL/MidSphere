# MidSphere Forensic Time Travel Mode

## Punchline

**Scrub the closed loop — not the warehouse clock.** Forensic Time Travel is an operator narrative of how contamination spreads and how MidSphere selectively trips the context circuit.

It is **not** a live DataHub history browser and **not** proof that tags were written to GMS on every frame.

---

## Overview

The Command Center lineage canvas can show more than a single snapshot. The **Forensic Time Travel** controller (`TimeTravelBar.tsx`) lets operators scrub a five-step story:

1. Healthy baseline  
2. Audit finding on the source  
3. Cascade / blast radius  
4. Selective circuit trip (target mart **BLOCKED**, open fork **OPEN**)  
5. Fix artifact + MBOM attestation ready  

Use it to explain **selective halt** to judges and operators in under a minute.

---

## Time Travel Step Architecture

```
[Baseline] ──► [Sentinel] ──► [Cascade] ──► [Circuit] ──► [Attested]
   T-0            T-1            T-2           T-3           T-4
```

| Step | Stage | Graph & gate story |
| --- | --- | --- |
| **T-0** | Pre-incident baseline | All nodes **OPEN**, risk 0, calm edges |
| **T-1** | ContextSentinel | Source **IMPACTED** (quality / PII / freshness finding) |
| **T-2** | CascadeAnalyzer | Downstream hops impacted; selective fork still open |
| **T-3** | CircuitBreaker | Target mart **BLOCKED** (advisory); open fork stays **OPEN** |
| **T-4** | Fix + MBOM | Dry-run fix path + MBOM attestation artifact ready |

Timestamps in the UI are **story labels** for the closed-loop narrative, not GMS event-store times.

---

## Selective circuit breaking (the product truth)

At **T-3**:

- **Quarantined path:** Contaminated mart (e.g. `mart_billing`, `mart_customer_360`, `mart_monthly_revenue`) is treated as **BLOCKED** for MidSphere Consumer Gate clients.
- **Open fork:** Unaffected marts (e.g. `mart_demographics`, `mart_product_catalog`, `mart_trip_distance_stats`) remain **OPEN**.

This is **selective halt**, not a panic quarantine of the whole graph.

---

## Honesty contract (DataHub MCP)

| Claim | When true |
| --- | --- |
| Live `add_tags` / structured properties / `save_document` | GMS reachable **and** `TOOLS_IS_MUTATION_ENABLED=true` on the official MCP process |
| Job-local advisory quarantine only | GMS offline or mutations off → `mutations_applied=false`, `execution_mode=demo_closed_loop` or Antigravity with no live writes |
| Forensic scrubber | Always a **Command Center UX** over the MidSphere closed-loop story |

**Allowed:** “MidSphere writes advisory quarantine metadata when mutations are enabled.”  
**Forbidden:** “MCP blocks all agents from reading quarantined entities.”

Real MCP tool names only: `get_lineage`, `add_tags`, `save_document`, etc. No invented `datahub_*` prefixes.

---

## Related

- Closed loop: `backend/agents/pipeline.py`, `backend/agents/stage_tools.py`
- UI: `frontend/src/components/graph/TimeTravelBar.tsx`, `LineageCanvas.tsx`
- Gate: `GET /v1/gate/{urn}`
