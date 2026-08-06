# MBOM: mart_billing — MidSphere audit (example)

> Offline example for judges. Replace with a live `save_document` result after E2E runs.

| Field | Value |
| --- | --- |
| Document type | Analysis |
| Topics | midsphere, circuit-breaker, data-quality |
| Related assets | `urn:li:dataset:(…healthcare…mart_billing…)` |
| Gate status | BLOCKED (advisory) |

## Summary

ContextSentinel detected **negative billing amounts** propagating from `raw_patients` through `staging_patients` into `mart_billing`. CascadeAnalyzer scored selective impact: **billing fork only** — `mart_demographics` remains open.

## Findings

| Type | Severity | Entity | Evidence |
| --- | --- | --- | --- |
| NEGATIVE_BILLING | HIGH | raw_patients / mart_billing | ~2% rows with billing_amount &lt; 0 (seeded dataset) |
| DATE_SWAP | MEDIUM | raw_patients | admission after discharge on subset of rows |

## Blast radius

```
raw_patients → staging_patients → mart_billing        [IMPACTED]
                               → mart_demographics   [not impacted by this finding set]
```

Risk score: **61 / 100** (matches closed-loop default for healthcare).

## Quarantine applied (advisory)

- Tags: `QUARANTINED`, `CIRCUIT_BROKEN`, `MIDSPHERE_AUDIT`
- Structured property: `midsphere.gate_status = BLOCKED`
- MidSphere Consumer Gate: returns BLOCKED context for impacted URNs

## Remediation

- PR (example): filter negative billing + assert non-negative in staging transform
- Diff path: `examples/prs/fix-negative-billing.example.diff`

## Lift criteria

1. Merge fix PR / apply transform  
2. Re-scan clean  
3. `remove_tags` + `gate_status=LIFTED`
