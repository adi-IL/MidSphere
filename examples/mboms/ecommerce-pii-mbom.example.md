# MBOM: ecommerce mart_customer_360 (offline example)

Offline judge artifact. Path referenced by `backend/agents/scenarios.py` as  
`examples/mboms/ecommerce-pii-mbom.example.md`.  
Document URN (scenario default): `urn:li:document:midsphere-ecommerce-mbom`.

When GMS mutations are enabled, a live job may also call MCP `save_document`.  
This file remains the dry-run / sample attestation.

| Field | Value |
| --- | --- |
| Scenario | ecommerce |
| Risk score | 88 |
| Quarantine target | `urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)` |
| Open fork | `urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.mart_product_catalog,PROD)` |
| Gate status | BLOCKED (advisory) |
| Sample execution mode | `demo_closed_loop` |
| Mutations in this artifact | false |

## Summary

ContextSentinel findings: unmasked SSN in the customer analytics mart and missing ownership on raw customers. CascadeAnalyzer marks selective impact: **mart_customer_360** impacted, **mart_product_catalog** open.

## Findings

| ID | Type | Severity | Entity | Column | Evidence |
| --- | --- | --- | --- | --- | --- |
| f_pii1 | UNGOVERNED_PII | CRITICAL | mart_customer_360 | social_security_number | Raw unhashed SSN exposed in customer_360 analytics mart |
| f_pii2 | MISSING_OWNER | HIGH | raw_customers | owner | Dataset ownership metadata is unassigned |

## Blast radius

```
raw_customers -> stg_customers -> mart_customer_360     [impacted]
                               -> mart_product_catalog  [open]
```

## Quarantine (advisory)

Tags: `PII_LEAK`, `QUARANTINED`, `MIDSPHERE_AUDIT`  
Property: `midsphere.gate_status = BLOCKED`  
Property: `midsphere.risk_score = 88`

## Remediation

Dry-run path: `examples/prs/fix-pii-masking.example.diff`  
Intent: hash `social_security_number` in the mart model (dbt-style).

## Lift criteria

1. Apply masking policy or merge equivalent fix.  
2. Re-run closed loop with clean result.  
3. Lift quarantine (live MCP when mutations are enabled; else job-local lift).
