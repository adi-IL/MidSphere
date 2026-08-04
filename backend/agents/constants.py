"""Shared MidSphere demo graph URNs and risk formula."""

from __future__ import annotations

URN_RAW = "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)"
URN_STAGING = (
    "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.staging_patients,PROD)"
)
URN_BILLING = (
    "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_billing,PROD)"
)
URN_DEMOGRAPHICS = (
    "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.mart_demographics,PROD)"
)

SEVERITY_WEIGHT = {"CRITICAL": 1.0, "HIGH": 0.75, "MEDIUM": 0.5, "LOW": 0.25}


def compute_risk_score(
    *,
    severity: str,
    downstream_count: int,
    has_pii: bool = True,
    has_production_env: bool = True,
    missing_owner: bool = False,
) -> int:
    sw = SEVERITY_WEIGHT.get(severity, 0.5)
    raw = (
        25 * sw
        + 25 * min(1.0, downstream_count / 10)
        + 20 * (1 if has_pii else 0)
        + 15 * (1 if has_production_env else 0)
        + 15 * (1 if missing_owner else 0)
    )
    return int(max(0, min(100, round(raw))))
