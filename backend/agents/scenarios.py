"""Shared MidSphere scenario contracts (single source of truth).

Used by Antigravity stage tools and the deterministic fallback so risk scores,
findings, blast nodes, PR paths, and MBOMs never drift.
"""

from __future__ import annotations

from typing import Any

from agents.constants import (
    URN_BILLING,
    URN_DEMOGRAPHICS,
    URN_RAW,
    URN_STAGING,
)
from models.artifacts import AuditFinding, BlastNode


def get_scenario_spec(root_urn: str) -> dict[str, Any]:
    """Resolve scenario pack from root URN keywords."""
    u = root_urn.lower()
    if "ecommerce" in u or "customers" in u:
        urn_raw_customers = (
            "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.raw_customers,PROD)"
        )
        urn_stg_customers = (
            "urn:li:dataset:(urn:li:dataPlatform:dbt,ecommerce.stg_customers,PROD)"
        )
        urn_mart_c360 = (
            "urn:li:dataset:(urn:li:dataPlatform:looker,ecommerce.mart_customer_360,PROD)"
        )
        urn_mart_catalog = (
            "urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.mart_product_catalog,PROD)"
        )

        return {
            "scenario": "ecommerce",
            "findings": [
                AuditFinding(
                    id="f_pii1",
                    type="UNGOVERNED_PII",
                    severity="CRITICAL",
                    entity_urn=urn_mart_c360,
                    column_path="social_security_number",
                    evidence="Raw unhashed SSN exposed in customer_360 analytics mart",
                    rationale="Unencrypted PII violates GDPR & HIPAA compliance policies",
                ),
                AuditFinding(
                    id="f_pii2",
                    type="MISSING_OWNER",
                    severity="HIGH",
                    entity_urn=urn_raw_customers,
                    column_path="owner",
                    evidence="Dataset ownership metadata is unassigned",
                    rationale="Orphan datasets increase compliance risk and response latency",
                ),
            ],
            "nodes": [
                BlastNode(
                    urn=urn_raw_customers,
                    name="raw_customers",
                    hop=0,
                    impacted=True,
                    reason="Contains raw unmasked customer PII",
                ),
                BlastNode(
                    urn=urn_stg_customers,
                    name="stg_customers",
                    hop=1,
                    impacted=True,
                    reason="Propagates unmasked SSN to analytics layer",
                ),
                BlastNode(
                    urn=urn_mart_c360,
                    name="mart_customer_360",
                    hop=2,
                    impacted=True,
                    reason="Exposes SSN to business intelligence dashboards",
                ),
                BlastNode(
                    urn=urn_mart_catalog,
                    name="mart_product_catalog",
                    hop=2,
                    impacted=False,
                    reason="No PII fields involved (selective halt)",
                ),
            ],
            "risk_score": 88,
            "target_urns": [urn_mart_c360],
            "quarantine_tags": [
                "urn:li:tag:PII_LEAK",
                "urn:li:tag:QUARANTINED",
                "urn:li:tag:MIDSPHERE_AUDIT",
            ],
            "pr_path": "examples/prs/fix-pii-masking.example.diff",
            "pr_summary": "Apply dbt column-level hashing & PII masking policy",
            "mbom_urn": "urn:li:document:midsphere-ecommerce-mbom",
            "mbom_path": "examples/mboms/ecommerce-pii-mbom.example.md",
        }

    if "nyctaxi" in u or "trips" in u or "taxi" in u or "yellow" in u:
        urn_raw_trips = (
            "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.raw_yellow_trips,PROD)"
        )
        urn_stg_fare = (
            "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.stg_trip_fare,PROD)"
        )
        urn_mart_revenue = (
            "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_monthly_revenue,PROD)"
        )
        urn_mart_dist = (
            "urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.mart_trip_distance_stats,PROD)"
        )

        return {
            "scenario": "nyctaxi",
            "findings": [
                AuditFinding(
                    id="f_taxi1",
                    type="FRESHNESS_VIOLATION",
                    severity="HIGH",
                    entity_urn=urn_mart_revenue,
                    column_path="pickup_datetime",
                    evidence="Last ingestion timestamp > 72 hours stale (SLA: 24h)",
                    rationale="Stale trip ingestion skews monthly revenue reports",
                ),
                AuditFinding(
                    id="f_taxi2",
                    type="SCHEMA_DRIFT",
                    severity="MEDIUM",
                    entity_urn=urn_raw_trips,
                    column_path="extra_surcharge",
                    evidence="Unannounced column addition extra_surcharge in raw ingestion",
                    rationale="Schema drift causes downstream dbt compilation failures",
                ),
            ],
            "nodes": [
                BlastNode(
                    urn=urn_raw_trips,
                    name="raw_yellow_trips",
                    hop=0,
                    impacted=True,
                    reason="Source table stale by 72h",
                ),
                BlastNode(
                    urn=urn_stg_fare,
                    name="stg_trip_fare",
                    hop=1,
                    impacted=True,
                    reason="Propagates stale ingestion timestamps",
                ),
                BlastNode(
                    urn=urn_mart_revenue,
                    name="mart_monthly_revenue",
                    hop=2,
                    impacted=True,
                    reason="Breaches SLA for executive financial reporting",
                ),
                BlastNode(
                    urn=urn_mart_dist,
                    name="mart_trip_distance_stats",
                    hop=2,
                    impacted=False,
                    reason="Non-time-critical analytics mart (selective halt)",
                ),
            ],
            "risk_score": 65,
            "target_urns": [urn_mart_revenue],
            "quarantine_tags": [
                "urn:li:tag:PIPELINE_LAG",
                "urn:li:tag:QUARANTINED",
                "urn:li:tag:MIDSPHERE_AUDIT",
            ],
            "pr_path": "examples/prs/fix-taxi-freshness.example.diff",
            "pr_summary": "Adjust BigQuery partition filter & freshness SLA window",
            "mbom_urn": "urn:li:document:midsphere-nyctaxi-mbom",
            "mbom_path": "examples/mboms/nyctaxi-revenue-mbom.example.md",
        }

    # Default: healthcare quality circuit
    return {
        "scenario": "healthcare",
        "findings": [
            AuditFinding(
                id="f1",
                type="NEGATIVE_BILLING",
                severity="HIGH",
                entity_urn=URN_BILLING,
                column_path="billing_amount",
                evidence="~2% rows with billing_amount < 0 (planted healthcare dataset)",
                rationale="Invalid financial measures poison billing mart aggregates",
            ),
            AuditFinding(
                id="f2",
                type="DATE_SWAP",
                severity="MEDIUM",
                entity_urn=URN_RAW,
                column_path="date_of_admission",
                evidence="admission after discharge on subset of rows",
                rationale="Produces negative length_of_stay in billing path",
            ),
        ],
        "nodes": [
            BlastNode(
                urn=URN_RAW,
                name="raw_patients",
                hop=0,
                impacted=True,
                reason="Source of planted quality issues",
            ),
            BlastNode(
                urn=URN_STAGING,
                name="staging_patients",
                hop=1,
                impacted=True,
                reason="Propagates source issues",
            ),
            BlastNode(
                urn=URN_BILLING,
                name="mart_billing",
                hop=2,
                impacted=True,
                reason="NEGATIVE_BILLING + DATE_SWAP cascade",
            ),
            BlastNode(
                urn=URN_DEMOGRAPHICS,
                name="mart_demographics",
                hop=2,
                impacted=False,
                reason="Not affected by this finding set (selective halt)",
            ),
        ],
        "risk_score": 61,
        "target_urns": [URN_BILLING],
        "quarantine_tags": [
            "urn:li:tag:QUARANTINED",
            "urn:li:tag:CIRCUIT_BROKEN",
            "urn:li:tag:MIDSPHERE_AUDIT",
        ],
        "pr_path": "examples/prs/fix-negative-billing.example.diff",
        "pr_summary": "filter negative billing + enforce admission<=discharge",
        "mbom_urn": "urn:li:document:midsphere-mbom-example",
        "mbom_path": "examples/mboms/healthcare-billing-mbom.example.md",
    }
