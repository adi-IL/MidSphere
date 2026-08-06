# MidSphere Audit Attestation (MBOM) — NYC Taxi Revenue Freshness

**Document URN:** `urn:li:document:midsphere-nyctaxi-mbom`  
**Execution Mode:** `antigravity_closed_loop`  
**Data Platform:** `BigQuery`  
**Target Entity:** `urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)`

---

## Executive Summary

MidSphere ContextSentinel detected a **FRESHNESS_VIOLATION** (HIGH) on `mart_monthly_revenue`. Ingestion lag exceeded 72 hours (SLA constraint: 24h), distorting executive monthly financial reporting.

---

## Audit Findings

| Finding ID | Type | Severity | Entity URN | Column | Rationale |
| --- | --- | --- | --- | --- | --- |
| `f_taxi1` | `FRESHNESS_VIOLATION` | **HIGH** | `...nyctaxi.mart_monthly_revenue,PROD)` | `pickup_datetime` | Stale ingestion skews executive monthly revenue reports |
| `f_taxi2` | `SCHEMA_DRIFT` | **MEDIUM** | `...nyctaxi.raw_yellow_trips,PROD)` | `extra_surcharge` | Unannounced column addition causes dbt compilation errors |

---

## Selective Circuit Breaking

- **Quarantined Asset:** `mart_monthly_revenue` set to `BLOCKED` (advisory). Intended tags: `PIPELINE_LAG`, `QUARANTINED`, `MIDSPHERE_AUDIT` — written live only when GMS + mutations are enabled; otherwise job-local on the MidSphere job artifact.
- **Open Lineage Fork:** `mart_trip_distance_stats` remains **OPEN** with zero risk score.

---

## Remediation

The FixArchitect generated a dry-run BigQuery partition fix PR at `examples/prs/fix-taxi-freshness.example.diff` adjusting the partition filter window.
