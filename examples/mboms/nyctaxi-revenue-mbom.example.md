# MBOM: nyctaxi mart_monthly_revenue (offline example)

Offline judge artifact. Path referenced by `backend/agents/scenarios.py` as  
`examples/mboms/nyctaxi-revenue-mbom.example.md`.  
Document URN (scenario default): `urn:li:document:midsphere-nyctaxi-mbom`.

When GMS mutations are enabled, a live job may also call MCP `save_document`.  
This file remains the dry-run / sample attestation.

| Field | Value |
| --- | --- |
| Scenario | nyctaxi |
| Risk score | 65 |
| Quarantine target | `urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)` |
| Open fork | `urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_trip_distance_stats,PROD)` |
| Gate status | BLOCKED (advisory) |
| Sample execution mode | `demo_closed_loop` |
| Mutations in this artifact | false |

## Summary

ContextSentinel findings: freshness violation on monthly revenue and schema drift on raw trips. CascadeAnalyzer marks selective impact: **mart_monthly_revenue** impacted, **mart_trip_distance_stats** open.

## Findings

| ID | Type | Severity | Entity | Column | Rationale (scenario) |
| --- | --- | --- | --- | --- | --- |
| f_taxi1 | FRESHNESS_VIOLATION | HIGH | mart_monthly_revenue | pickup_datetime | Stale ingestion skews executive monthly revenue reports |
| f_taxi2 | SCHEMA_DRIFT | MEDIUM | raw_yellow_trips | extra_surcharge | Unannounced column addition causes dbt compilation errors |

## Blast radius

```
raw_yellow_trips -> stg_trip_fare -> mart_monthly_revenue      [impacted]
                                  -> mart_trip_distance_stats  [open]
```

## Quarantine (advisory)

Tags: `PIPELINE_LAG`, `QUARANTINED`, `MIDSPHERE_AUDIT`  
Property: `midsphere.gate_status = BLOCKED`  
Property: `midsphere.risk_score = 65`

## Remediation

Dry-run path: `examples/prs/fix-taxi-freshness.example.diff`  
Intent: tighten partition filter window on the revenue mart.

## Lift criteria

1. Restore freshness SLA or merge equivalent fix.  
2. Re-run closed loop with clean result.  
3. Lift quarantine (live MCP when mutations are enabled; else job-local lift).
