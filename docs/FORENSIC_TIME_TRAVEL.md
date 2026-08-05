# MidSphere Forensic Time Travel Mode

## Overview

**Forensic Time Travel Mode** transforms MidSphere from a static lineage diagram into an interactive, time-aware forensic investigation tool for DataHub.

Instead of displaying only the instantaneous state of a data pipeline, the Forensic Time Travel controller (`TimeTravelBar.tsx`) allows data engineers, security auditors, and pipeline operators to scrub through time, watch contamination spread frame-by-frame across downstream lineage hops, inspect the exact moment a circuit breaker tripped, and verify selective quarantine decisions.

---

## Time Travel Step Architecture

```
[09:20 Baseline] ────► [09:24 Sentinel] ────► [09:28 Cascade] ────► [09:31 Circuit] ────► [09:35 Attested]
     Step 0                 Step 1                Step 2               Step 3               Step 4
```

| Time Step | Timestamp | Active Swarm Stage | Graph & Gate State | Description |
| --- | --- | --- | --- | --- |
| **`T-0`** | `09:20:00` | **Pre-Incident Baseline** | All Nodes: `● OPEN`<br>Risk Score: `0`<br>Edges: `Clean Flow` | Healthy pre-incident baseline state. All tables operating within SLA SLAs. |
| **`T-1`** | `09:24:12` | **ContextSentinel** | Ingestion Source: `● IMPACTED`<br>Risk Score: `88`<br>Edges: `PII Exposure` | Audit finding triggered on ingestion source (e.g. `raw_patients`, `raw_customers`, `raw_yellow_trips`). |
| **`T-2`** | `09:28:45` | **CascadeAnalyzer** | Hop 0 + Hop 1: `● IMPACTED`<br>Blast Radius: Calculated | Contamination ripples downstream into dbt staging models (`staging_patients`, `stg_customers`, `stg_trip_fare`). |
| **`T-3`** | `09:31:02` | **CircuitBreaker** | Target Mart: `⛔ BLOCKED`<br>Unaffected Fork: `● OPEN` | Advisory quarantine applied. `QUARANTINED` & `CIRCUIT_BROKEN` tags published to DataHub. Consumer Gate sets `midsphere.gate_status = BLOCKED`. |
| **`T-4`** | `09:35:10` | **FixArchitect & MBOMEngine** | Remediation: Ready<br>Attestation: Published | Automated dbt SQL fix diff generated; MBOM audit attestation document registered in DataHub via `save_document`. |

---

## Selective Circuit Breaking

During **Step 3** (`09:31:02 CircuitBreaker`), MidSphere demonstrates **Selective Circuit Breaking**:

- **Quarantined Path:** Contaminated marts (e.g., `mart_billing` or `mart_customer_360`) are set to `BLOCKED`. Downstream BI dashboards and APIs checking `GET /v1/gate/{urn}` receive `BLOCKED` status and refuse execution.
- **Open Lineage Fork:** Unaffected tables on separate lineage forks (e.g., `mart_demographics` or `mart_product_catalog`) remain **OPEN** with zero risk score, allowing unaffected business operations to continue running without interruption.

---

## DataHub MCP Integration

Forensic Time Travel decisions are fully synchronized with the official DataHub MCP server (`uvx mcp-server-datahub@latest`):

1. **Tag Writing:** `add_tags` applies `urn:li:tag:QUARANTINED` and `urn:li:tag:CIRCUIT_BROKEN` to target entities.
2. **Structured Property Mutation:** `add_structured_properties` sets `midsphere.gate_status = BLOCKED` / `LIFTED`.
3. **Attestation Publishing:** `save_document` registers the MBOM attestation markdown artifact in DataHub's context graph.
