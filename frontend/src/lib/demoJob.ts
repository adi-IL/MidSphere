import type { JobArtifact } from "./types";

/** Offline sample — mirrors examples/jobs/healthcare-sample.example.json */
export const DEMO_JOB: JobArtifact = {
  job_id: "example-healthcare-001",
  root_urn:
    "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)",
  mode: "full",
  status: "succeeded",
  findings: [
    {
      id: "f1",
      type: "NEGATIVE_BILLING",
      severity: "HIGH",
      entity_urn:
        "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)",
      column_path: "billing_amount",
      evidence: "~2% rows with billing_amount < 0 (planted healthcare dataset)",
      rationale: "Invalid financial measures poison billing mart aggregates",
    },
    {
      id: "f2",
      type: "DATE_SWAP",
      severity: "MEDIUM",
      entity_urn:
        "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)",
      column_path: "date_of_admission",
      evidence: "admission after discharge on subset of rows",
      rationale: "Produces negative length_of_stay in billing path",
    },
  ],
  blast_radius: {
    risk_score: 72,
    nodes: [
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)",
        name: "raw_patients",
        hop: 0,
        impacted: true,
        reason: "Source of planted quality issues",
      },
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.staging_patients,PROD)",
        name: "staging_patients",
        hop: 1,
        impacted: true,
        reason: "Propagates source issues",
      },
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)",
        name: "mart_billing",
        hop: 2,
        impacted: true,
        reason: "NEGATIVE_BILLING + DATE_SWAP cascade",
      },
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_demographics,PROD)",
        name: "mart_demographics",
        hop: 2,
        impacted: false,
        reason: "Not affected by this finding set (selective halt)",
      },
    ],
  },
  quarantine: {
    entityUrns: [
      "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)",
    ],
    tagsApplied: [
      "urn:li:tag:QUARANTINED",
      "urn:li:tag:CIRCUIT_BROKEN",
      "urn:li:tag:MIDSPHERE_AUDIT",
    ],
    properties: {
      "midsphere.gate_status": "BLOCKED",
      "midsphere.risk_score": "72",
    },
    gateStatus: "BLOCKED",
  },
  pr: {
    status: "dry_run",
    path: "examples/prs/fix-negative-billing.example.diff",
  },
  mbom: {
    path: "examples/mboms/healthcare-billing-mbom.example.md",
    document_urn: "urn:li:document:midsphere-mbom-example",
  },
  events: [
    {
      ts: "14:02:01.012",
      agent: "ContextSentinel",
      kind: "TOOL",
      message: "get_lineage urn=…raw_patients max_hops=2 240ms",
    },
    {
      ts: "14:02:01.310",
      agent: "ContextSentinel",
      kind: "FIND",
      message: "NEGATIVE_BILLING severity=HIGH entity=…mart_billing",
    },
    {
      ts: "14:02:03.400",
      agent: "CascadeAnalyzer",
      kind: "SCORE",
      message: "risk=72 impacted=selective billing=yes demographics=no",
    },
    {
      ts: "14:02:04.010",
      agent: "CircuitBreaker",
      kind: "TOOL",
      message: "add_tags QUARANTINED,CIRCUIT_BROKEN entities=1",
    },
    {
      ts: "14:02:04.400",
      agent: "CircuitBreaker",
      kind: "WRITE",
      message: "gate_status=BLOCKED ok",
    },
    {
      ts: "14:02:06.800",
      agent: "FixArchitect",
      kind: "PR",
      message: "dry_run path=examples/prs/fix-negative-billing.example.diff",
    },
    {
      ts: "14:02:07.500",
      agent: "MBOMEngine",
      kind: "MBOM",
      message: "save_document related_assets linked",
    },
  ],
};

export const DEMO_DIFF = `--- a/models/staging/stg_patients.sql
+++ b/models/staging/stg_patients.sql
@@ -1,12 +1,18 @@
 with source as (
   select * from {{ ref('raw_patients') }}
 ),
 cleaned as (
   select
     name,
     age,
     billing_amount,
     date_of_admission,
     discharge_date
   from source
+  where billing_amount is not null
+    and billing_amount >= 0
+    and (
+      discharge_date is null
+      or date_of_admission <= discharge_date
+    )
 )
 select * from cleaned
`;

export const DEMO_MBOM = `# MBOM: mart_billing — MidSphere audit

**Gate:** BLOCKED (advisory) · **Risk:** 72

## Summary
Negative billing cascade into \`mart_billing\`. Demographics fork left open (selective halt).

## Findings
| Type | Severity | Column |
| --- | --- | --- |
| NEGATIVE_BILLING | HIGH | billing_amount |
| DATE_SWAP | MEDIUM | date_of_admission |

## Lift criteria
1. Merge fix filter on non-negative billing + date order  
2. Re-scan clean  
3. remove_tags + gate_status=LIFTED
`;
