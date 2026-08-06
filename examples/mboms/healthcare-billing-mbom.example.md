# MBOM: healthcare mart_billing (offline example)

Offline judge artifact. Path referenced by `backend/agents/scenarios.py` as  
`examples/mboms/healthcare-billing-mbom.example.md`.  
Document URN (scenario default): `urn:li:document:midsphere-mbom-example`.

When GMS mutations are enabled, a live job may also call MCP `save_document`.  
This file remains the dry-run / sample attestation.

| Field | Value |
| --- | --- |
| Scenario | healthcare |
| Risk score | 61 |
| Root | `urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)` |
| Quarantine target | `urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)` |
| Open fork | `urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_demographics,PROD)` |
| Gate status | BLOCKED (advisory) |
| Sample execution mode | `demo_closed_loop` |
| Mutations in this artifact | false |

## Summary

ContextSentinel findings: negative billing amounts and admission/discharge date swaps on the healthcare path. CascadeAnalyzer marks selective impact: **mart_billing** impacted, **mart_demographics** open.

## Findings

| Type | Severity | Entity | Column | Evidence |
| --- | --- | --- | --- | --- |
| NEGATIVE_BILLING | HIGH | mart_billing | billing_amount | ~2% rows with billing_amount &lt; 0 (planted healthcare dataset) |
| DATE_SWAP | MEDIUM | raw_patients | date_of_admission | admission after discharge on subset of rows |

## Blast radius

```
raw_patients -> staging_patients -> mart_billing        [impacted]
                                 -> mart_demographics   [open]
```

## Quarantine (advisory)

Tags: `QUARANTINED`, `CIRCUIT_BROKEN`, `MIDSPHERE_AUDIT`  
Property: `midsphere.gate_status = BLOCKED`  
Property: `midsphere.risk_score = 61`

MidSphere Consumer Gate returns BLOCKED for URNs in the job quarantine set.

## Remediation

Dry-run path: `examples/prs/fix-negative-billing.example.diff`  
Intent: filter non-negative billing and enforce admission date &lt;= discharge date in staging.

## Lift criteria

1. Apply transform or merge equivalent fix.  
2. Re-run closed loop with clean result.  
3. Lift quarantine (`remove_tags` / `gate_status=LIFTED` when mutations are enabled; else job-local lift).
