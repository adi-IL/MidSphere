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
    risk_score: 61,
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
      "midsphere.risk_score": "61",
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
  execution_mode: "demo_closed_loop",
  mutations_applied: false,
  datahub_reachable: false,
  events: [
    {
      ts: "14:02:01.012",
      agent: "ContextSentinel",
      kind: "STATUS",
      message: "sim get_lineage urn=…raw_patients max_hops=2 downstream 240ms (demo artifact)",
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
      message: "risk=61 impacted=selective billing=yes demographics=no",
      latency_ms: 110,
      items_processed: 2,
    },
    {
      ts: "14:02:04.010",
      agent: "CircuitBreaker",
      kind: "STATUS",
      message: "sim add_tags QUARANTINED,CIRCUIT_BROKEN entities=1 (demo artifact)",
      latency_ms: 85,
    },
    {
      ts: "14:02:04.400",
      agent: "CircuitBreaker",
      kind: "STATUS",
      message: "sim gate_status=BLOCKED ok (demo artifact)",
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
      message: "sim save_document related_assets linked (demo artifact)",
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
          "midsphere.risk_score": "61",
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
  execution_mode: "demo_closed_loop",
  mutations_applied: false,
  datahub_reachable: false,
  events: [
    {
      ts: "14:10:01.000",
      agent: "ContextSentinel",
      kind: "STATUS",
      message: "sim get_lineage urn=…raw_customers max_hops=2 310ms (demo artifact)",
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
      kind: "STATUS",
      message: "sim add_tags PII_LEAK,QUARANTINED entities=1 (demo artifact)",
      latency_ms: 90,
    },
    {
      ts: "14:10:03.200",
      agent: "CircuitBreaker",
      kind: "STATUS",
      message: "sim gate_status=BLOCKED ok (demo artifact)",
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
      message: "sim save_document PII_compliance_attestation linked (demo artifact)",
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
  execution_mode: "demo_closed_loop",
  mutations_applied: false,
  datahub_reachable: false,
  events: [
    {
      ts: "14:15:01.000",
      agent: "ContextSentinel",
      kind: "STATUS",
      message: "sim get_lineage urn=…raw_yellow_trips max_hops=2 220ms (demo artifact)",
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
      kind: "STATUS",
      message: "sim add_tags PIPELINE_LAG,QUARANTINED entities=1 (demo artifact)",
      latency_ms: 80,
    },
    {
      ts: "14:15:03.000",
      agent: "CircuitBreaker",
      kind: "STATUS",
      message: "sim gate_status=BLOCKED ok (demo artifact)",
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
      message: "sim save_document freshness_SLA_attestation linked (demo artifact)",
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

/** Healthcare fix diff — matches examples/prs/fix-negative-billing.example.diff */
export const HEALTHCARE_DIFF = `--- a/models/staging/stg_patients.sql
+++ b/models/staging/stg_patients.sql
@@ -1,12 +1,18 @@
 -- Example FixArchitect output (dry-run). Ground in get_dataset_queries in production.
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

/** Ecommerce PII masking — matches examples/prs/fix-pii-masking.example.diff */
export const ECOMMERCE_DIFF = `--- a/models/marts/mart_customer_360.sql
+++ b/models/marts/mart_customer_360.sql
@@ -12,7 +12,7 @@ select
     customer_id,
     first_name,
     last_name,
-    social_security_number,
+    to_hex(sha256(social_security_number)) as social_security_number_hash,
     email_address
 from {{ ref('stg_customers') }}
`;

/** NYC taxi freshness — matches examples/prs/fix-taxi-freshness.example.diff */
export const NYCTAXI_DIFF = `--- a/models/marts/mart_monthly_revenue.sql
+++ b/models/marts/mart_monthly_revenue.sql
@@ -8,5 +8,5 @@ select
     sum(fare_amount) as total_revenue
 from {{ ref('stg_trip_fare') }}
-where pickup_datetime >= current_date() - interval 7 day
+where pickup_datetime >= current_date() - interval 1 day
`;

/** Healthcare MBOM — aligned with backend risk 61 */
export const HEALTHCARE_MBOM = `# MBOM: mart_billing — MidSphere audit (example)

> Offline example for judges. Live path uses \`save_document\` when GMS + mutations are enabled.

| Field | Value |
| --- | --- |
| Document type | Analysis |
| Topics | midsphere, circuit-breaker, data-quality |
| Related assets | healthcare.mart_billing |
| Gate status | BLOCKED (advisory) |
| Risk | **61 / 100** |

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

export const ECOMMERCE_MBOM = `# MBOM: mart_customer_360 — MidSphere audit (example)

| Field | Value |
| --- | --- |
| Gate status | BLOCKED (advisory) |
| Risk | **88 / 100** |
| Open fork | mart_product_catalog |

## Summary

Unmasked SSN in customer 360 analytics mart. Product catalog left open (selective halt).

## Findings

| Type | Severity | Column |
| --- | --- | --- |
| UNGOVERNED_PII | CRITICAL | social_security_number |
| MISSING_OWNER | HIGH | owner |

## Remediation

\`examples/prs/fix-pii-masking.example.diff\` — SHA-256 hash SSN in dbt mart.
`;

export const NYCTAXI_MBOM = `# MBOM: mart_monthly_revenue — MidSphere audit (example)

| Field | Value |
| --- | --- |
| Gate status | BLOCKED (advisory) |
| Risk | **65 / 100** |
| Open fork | mart_trip_distance_stats |

## Summary

Freshness SLA breach (72h lag vs 24h SLA) on monthly revenue. Distance stats left open.

## Findings

| Type | Severity | Column |
| --- | --- | --- |
| FRESHNESS_VIOLATION | HIGH | pickup_datetime |
| SCHEMA_DRIFT | MEDIUM | extra_surcharge |

## Remediation

\`examples/prs/fix-taxi-freshness.example.diff\` — tighten partition filter window.
`;

/** @deprecated Use resolveFixDiff(job) — healthcare alias */
export const DEMO_DIFF = HEALTHCARE_DIFF;
/** @deprecated Use resolveMbomMarkdown(job) — healthcare alias */
export const DEMO_MBOM = HEALTHCARE_MBOM;

function scenarioKeyFromJob(job: JobArtifact | null | undefined): "healthcare" | "ecommerce" | "nyctaxi" {
  const blob = [
    job?.root_urn ?? "",
    job?.pr?.path ?? "",
    job?.mbom?.path ?? "",
    ...(job?.findings?.map((f) => f.type) ?? []),
  ]
    .join(" ")
    .toLowerCase();
  if (blob.includes("ecommerce") || blob.includes("pii") || blob.includes("customer")) {
    return "ecommerce";
  }
  if (blob.includes("nyctaxi") || blob.includes("taxi") || blob.includes("freshness") || blob.includes("trips")) {
    return "nyctaxi";
  }
  return "healthcare";
}

/** Scenario-correct fix diff for Inspector Fix tab. */
export function resolveFixDiff(job: JobArtifact | null | undefined): string {
  const key = scenarioKeyFromJob(job);
  if (key === "ecommerce") return ECOMMERCE_DIFF;
  if (key === "nyctaxi") return NYCTAXI_DIFF;
  return HEALTHCARE_DIFF;
}

/** Scenario-correct MBOM markdown for Inspector MBOM tab. */
export function resolveMbomMarkdown(job: JobArtifact | null | undefined): string {
  const key = scenarioKeyFromJob(job);
  if (key === "ecommerce") return ECOMMERCE_MBOM;
  if (key === "nyctaxi") return NYCTAXI_MBOM;
  return HEALTHCARE_MBOM;
}

/** Hot lineage edge label — scenario-aware, not always "PII". */
export function resolveHotEdgeLabel(jobOrLabel?: JobArtifact | string | null): string {
  if (typeof jobOrLabel === "string") {
    const s = jobOrLabel.toLowerCase();
    if (s.includes("commerce") || s.includes("pii")) return "PII risk path";
    if (s.includes("taxi") || s.includes("fresh")) return "Stale path";
    return "Quality risk path";
  }
  const key = scenarioKeyFromJob(jobOrLabel);
  if (key === "ecommerce") return "PII risk path";
  if (key === "nyctaxi") return "Stale path";
  return "Quality risk path";
}
