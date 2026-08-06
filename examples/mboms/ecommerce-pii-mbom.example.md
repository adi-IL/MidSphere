# MidSphere Audit Attestation (MBOM) — E-Commerce PII Governance

**Document URN:** `urn:li:document:midsphere-ecommerce-mbom`  
**Execution Mode:** `antigravity_closed_loop`  
**Data Platform:** `Snowflake` / `Looker` / `dbt`  
**Target Entity:** `urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)`

---

## Executive Summary

MidSphere ContextSentinel detected **UNGOVERNED_PII** (CRITICAL) exposed in `mart_customer_360`. Raw unhashed Social Security Numbers were being transmitted to business intelligence dashboards without column-level encryption or masking policies.

---

## Audit Findings

| Finding ID | Type | Severity | Entity URN | Column | Rationale |
| --- | --- | --- | --- | --- | --- |
| `f_pii1` | `UNGOVERNED_PII` | **CRITICAL** | `...ecommerce.mart_customer_360,PROD)` | `social_security_number` | Unmasked PII in analytics mart violates typical privacy / governance policy |
| `f_pii2` | `MISSING_OWNER` | **HIGH** | `...ecommerce.raw_customers,PROD)` | `owner` | Unassigned dataset ownership metadata |

---

## Selective Circuit Breaking

- **Quarantined Asset:** `mart_customer_360` set to `BLOCKED` (advisory). Intended tags: `QUARANTINED`, `CIRCUIT_BROKEN`, `MIDSPHERE_AUDIT` — written live only when GMS + mutations are enabled; otherwise job-local on the MidSphere job artifact.
- **Open Lineage Fork:** `mart_product_catalog` remains **OPEN** with zero risk score.

---

## Remediation

The FixArchitect generated a dry-run dbt column-level hashing PR at `examples/prs/fix-pii-masking.example.diff` replacing `social_security_number` with `to_hex(sha256(social_security_number))`.
