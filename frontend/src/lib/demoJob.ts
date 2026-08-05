import type { JobArtifact } from "./types";

/** Healthcare Hospital Quality Scenario */
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
    diff_summary: "Filter negative billing_amount and enforce admission <= discharge",
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
      latency_ms: 240,
      items_processed: 4,
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
      latency_ms: 110,
      items_processed: 2,
    },
    {
      ts: "14:02:04.010",
      agent: "CircuitBreaker",
      kind: "TOOL",
      message: "add_tags QUARANTINED,CIRCUIT_BROKEN entities=1",
      latency_ms: 85,
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
      latency_ms: 180,
    },
    {
      ts: "14:02:07.500",
      agent: "MBOMEngine",
      kind: "MBOM",
      message: "save_document related_assets linked",
      latency_ms: 120,
    },
  ],
  aspects: [
    {
      urn: "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)",
      aspectName: "GlobalTags",
      aspectValue: {
        tags: [
          { tag: "urn:li:tag:QUARANTINED" },
          { tag: "urn:li:tag:CIRCUIT_BROKEN" },
          { tag: "urn:li:tag:MIDSPHERE_AUDIT" },
        ],
      },
    },
    {
      urn: "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)",
      aspectName: "StructuredProperties",
      aspectValue: {
        properties: {
          "midsphere.gate_status": "BLOCKED",
          "midsphere.risk_score": "72",
          "midsphere.job_id": "example-healthcare-001",
        },
      },
    },
    {
      urn: "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)",
      aspectName: "DatasetProperties",
      aspectValue: {
        description: "Billing aggregation mart. Gated by MidSphere due to negative billing anomaly.",
        customProperties: {
          "data_quality_tier": "Tier-1 Financial",
          "audit_status": "Circuit Broken",
        },
      },
    },
  ],
};

/** E-Commerce PII Governance Scenario */
export const ECOMMERCE_JOB: JobArtifact = {
  job_id: "example-ecommerce-002",
  root_urn:
    "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.raw_customers,PROD)",
  mode: "full",
  status: "succeeded",
  findings: [
    {
      id: "f_pii1",
      type: "UNGOVERNED_PII",
      severity: "CRITICAL",
      entity_urn:
        "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.mart_customer_360,PROD)",
      column_path: "social_security_number",
      evidence: "Raw unhashed SSN exposed in customer_360 analytics mart",
      rationale: "Unencrypted PII violates GDPR & HIPAA compliance policies",
    },
    {
      id: "f_pii2",
      type: "MISSING_OWNER",
      severity: "HIGH",
      entity_urn:
        "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.raw_customers,PROD)",
      column_path: "owner",
      evidence: "Dataset ownership metadata is unassigned",
      rationale: "Orphan datasets increase compliance risk and response latency",
    },
  ],
  blast_radius: {
    risk_score: 88,
    nodes: [
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.raw_customers,PROD)",
        name: "raw_customers",
        hop: 0,
        impacted: true,
        reason: "Contains raw unmasked customer PII",
      },
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:dbt,ecommerce.stg_customers,PROD)",
        name: "stg_customers",
        hop: 1,
        impacted: true,
        reason: "Propagates unmasked SSN to analytics layer",
      },
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)",
        name: "mart_customer_360",
        hop: 2,
        impacted: true,
        reason: "Exposes SSN to business intelligence dashboards",
      },
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.mart_product_catalog,PROD)",
        name: "mart_product_catalog",
        hop: 2,
        impacted: false,
        reason: "No PII fields involved (selective halt)",
      },
    ],
  },
  quarantine: {
    entityUrns: [
      "urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)",
    ],
    tagsApplied: [
      "urn:li:tag:PII_LEAK",
      "urn:li:tag:QUARANTINED",
      "urn:li:tag:MIDSPHERE_AUDIT",
    ],
    properties: {
      "midsphere.gate_status": "BLOCKED",
      "midsphere.risk_score": "88",
    },
    gateStatus: "BLOCKED",
  },
  pr: {
    status: "dry_run",
    path: "examples/prs/fix-pii-masking.example.diff",
    diff_summary: "Apply SHA-256 hashing to SSN in stg_customers.sql",
  },
  mbom: {
    path: "examples/mboms/ecommerce-pii-mbom.example.md",
    document_urn: "urn:li:document:midsphere-ecommerce-mbom",
  },
  events: [
    {
      ts: "14:10:01.000",
      agent: "ContextSentinel",
      kind: "TOOL",
      message: "get_lineage urn=…raw_customers max_hops=2 310ms",
      latency_ms: 310,
      items_processed: 4,
    },
    {
      ts: "14:10:01.300",
      agent: "ContextSentinel",
      kind: "FIND",
      message: "UNGOVERNED_PII severity=CRITICAL entity=…mart_customer_360",
    },
    {
      ts: "14:10:02.100",
      agent: "CascadeAnalyzer",
      kind: "SCORE",
      message: "risk=88 impacted=3 PII_leak=true product_catalog=clean",
      latency_ms: 140,
      items_processed: 3,
    },
    {
      ts: "14:10:02.800",
      agent: "CircuitBreaker",
      kind: "TOOL",
      message: "add_tags PII_LEAK,QUARANTINED entities=1",
      latency_ms: 90,
    },
    {
      ts: "14:10:03.200",
      agent: "CircuitBreaker",
      kind: "WRITE",
      message: "gate_status=BLOCKED ok",
    },
    {
      ts: "14:10:04.500",
      agent: "FixArchitect",
      kind: "PR",
      message: "dry_run path=examples/prs/fix-pii-masking.example.diff",
      latency_ms: 210,
    },
    {
      ts: "14:10:05.100",
      agent: "MBOMEngine",
      kind: "MBOM",
      message: "save_document PII_compliance_attestation linked",
      latency_ms: 130,
    },
  ],
  aspects: [
    {
      urn: "urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)",
      aspectName: "GlobalTags",
      aspectValue: {
        tags: [
          { tag: "urn:li:tag:PII_LEAK" },
          { tag: "urn:li:tag:QUARANTINED" },
          { tag: "urn:li:tag:MIDSPHERE_AUDIT" },
        ],
      },
    },
    {
      urn: "urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)",
      aspectName: "StructuredProperties",
      aspectValue: {
        properties: {
          "midsphere.gate_status": "BLOCKED",
          "midsphere.risk_score": "88",
          "midsphere.job_id": "example-ecommerce-002",
        },
      },
    },
    {
      urn: "urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)",
      aspectName: "DatasetProperties",
      aspectValue: {
        description: "Customer 360 Looker dashboard view. Blocked due to unmasked SSN exposure.",
        customProperties: {
          "governance_tier": "Tier-0 Restricted PII",
          "compliance_status": "BLOCKED by MidSphere",
        },
      },
    },
  ],
};

/** NYC Taxi Pipeline Lag Scenario */
export const NYCTAXI_JOB: JobArtifact = {
  job_id: "example-nyctaxi-003",
  root_urn:
    "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.raw_yellow_trips,PROD)",
  mode: "full",
  status: "succeeded",
  findings: [
    {
      id: "f_taxi1",
      type: "FRESHNESS_VIOLATION",
      severity: "HIGH",
      entity_urn:
        "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)",
      column_path: "pickup_datetime",
      evidence: "Last ingestion timestamp > 72 hours stale (SLA: 24h)",
      rationale: "Stale trip ingestion skews monthly revenue reports",
    },
    {
      id: "f_taxi2",
      type: "SCHEMA_DRIFT",
      severity: "MEDIUM",
      entity_urn:
        "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.raw_yellow_trips,PROD)",
      column_path: "extra_surcharge",
      evidence: "Unannounced column addition extra_surcharge in raw ingestion",
      rationale: "Schema drift causes downstream dbt compilation failures",
    },
  ],
  blast_radius: {
    risk_score: 65,
    nodes: [
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.raw_yellow_trips,PROD)",
        name: "raw_yellow_trips",
        hop: 0,
        impacted: true,
        reason: "Source table stale by 72h",
      },
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.stg_trip_fare,PROD)",
        name: "stg_trip_fare",
        hop: 1,
        impacted: true,
        reason: "Propagates stale ingestion timestamps",
      },
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)",
        name: "mart_monthly_revenue",
        hop: 2,
        impacted: true,
        reason: "Breaches SLA for executive financial reporting",
      },
      {
        urn: "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_trip_distance_stats,PROD)",
        name: "mart_trip_distance_stats",
        hop: 2,
        impacted: false,
        reason: "Non-time-critical analytics mart (selective halt)",
      },
    ],
  },
  quarantine: {
    entityUrns: [
      "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)",
    ],
    tagsApplied: [
      "urn:li:tag:PIPELINE_LAG",
      "urn:li:tag:QUARANTINED",
      "urn:li:tag:MIDSPHERE_AUDIT",
    ],
    properties: {
      "midsphere.gate_status": "BLOCKED",
      "midsphere.risk_score": "65",
    },
    gateStatus: "BLOCKED",
  },
  pr: {
    status: "dry_run",
    path: "examples/prs/fix-taxi-freshness.example.diff",
    diff_summary: "Adjust BigQuery partition filter & freshness SLA window",
  },
  mbom: {
    path: "examples/mboms/nyctaxi-revenue-mbom.example.md",
    document_urn: "urn:li:document:midsphere-nyctaxi-mbom",
  },
  events: [
    {
      ts: "14:15:01.000",
      agent: "ContextSentinel",
      kind: "TOOL",
      message: "get_lineage urn=…raw_yellow_trips max_hops=2 220ms",
      latency_ms: 220,
      items_processed: 4,
    },
    {
      ts: "14:15:01.250",
      agent: "ContextSentinel",
      kind: "FIND",
      message: "FRESHNESS_VIOLATION severity=HIGH entity=…mart_monthly_revenue",
    },
    {
      ts: "14:15:02.000",
      agent: "CascadeAnalyzer",
      kind: "SCORE",
      message: "risk=65 SLA_breach=72h selective=true distance_stats=clean",
      latency_ms: 105,
      items_processed: 2,
    },
    {
      ts: "14:15:02.600",
      agent: "CircuitBreaker",
      kind: "TOOL",
      message: "add_tags PIPELINE_LAG,QUARANTINED entities=1",
      latency_ms: 80,
    },
    {
      ts: "14:15:03.000",
      agent: "CircuitBreaker",
      kind: "WRITE",
      message: "gate_status=BLOCKED ok",
    },
    {
      ts: "14:15:04.100",
      agent: "FixArchitect",
      kind: "PR",
      message: "dry_run path=examples/prs/fix-taxi-freshness.example.diff",
      latency_ms: 165,
    },
    {
      ts: "14:15:04.700",
      agent: "MBOMEngine",
      kind: "MBOM",
      message: "save_document freshness_SLA_attestation linked",
      latency_ms: 115,
    },
  ],
  aspects: [
    {
      urn: "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)",
      aspectName: "GlobalTags",
      aspectValue: {
        tags: [
          { tag: "urn:li:tag:PIPELINE_LAG" },
          { tag: "urn:li:tag:QUARANTINED" },
          { tag: "urn:li:tag:MIDSPHERE_AUDIT" },
        ],
      },
    },
    {
      urn: "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)",
      aspectName: "StructuredProperties",
      aspectValue: {
        properties: {
          "midsphere.gate_status": "BLOCKED",
          "midsphere.risk_score": "65",
          "midsphere.job_id": "example-nyctaxi-003",
        },
      },
    },
    {
      urn: "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)",
      aspectName: "DatasetProperties",
      aspectValue: {
        description: "Monthly revenue aggregation in BigQuery. Gated due to 72h freshness SLA violation.",
        customProperties: {
          "sla_window": "24h Max Stale",
          "current_lag": "72h Stale",
        },
      },
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
