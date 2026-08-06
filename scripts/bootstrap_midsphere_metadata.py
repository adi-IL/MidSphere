#!/usr/bin/env python3
"""Bootstrap tags and structured properties required by MidSphere CircuitBreaker.

Requires a reachable DataHub GMS (DATAHUB_GMS_URL / DATAHUB_GMS_TOKEN or ~/.datahubenv).
Idempotent best-effort: creates missing tags/properties; prints guidance on failure.

Full GraphQL mutation shapes may vary by GMS version  -  prefer acryl-datahub SDK when available.
This script is a scaffold; expand against live GMS during implementation.
"""

from __future__ import annotations

import os
import sys

TAGS = [
    ("QUARANTINED", "MidSphere advisory quarantine  -  do not trust for agent context"),
    ("CIRCUIT_BROKEN", "MidSphere circuit-breaker tripped on this asset"),
    ("MIDSPHERE_AUDIT", "Asset was audited by MidSphere"),
]

STRUCTURED_PROPERTIES = [
    ("midsphere.gate_status", "string", "OPEN | BLOCKED | LIFTED"),
    ("midsphere.risk_score", "number", "0-100 MidSphere risk score"),
    ("midsphere.job_id", "string", "MidSphere job id that last mutated this asset"),
    ("midsphere.pr_url", "string", "Remediation PR URL if any"),
]


def main() -> int:
    gms = os.environ.get("DATAHUB_GMS_URL")
    token = os.environ.get("DATAHUB_GMS_TOKEN")
    print("MidSphere metadata bootstrap")
    print(f"  DATAHUB_GMS_URL={gms or '(unset  -  using CLI default / ~/.datahubenv)'}")
    print(f"  token={'set' if token else 'unset'}")
    print()
    print("Required tags:")
    for name, desc in TAGS:
        print(f"  - urn:li:tag:{name}  # {desc}")
    print()
    print("Required structured properties:")
    for qn, typ, desc in STRUCTURED_PROPERTIES:
        print(f"  - {qn} ({typ})  # {desc}")
    print()
    print(
        "STATUS: scaffold only  -  this script does NOT create tags or properties yet.\n"
        "Create them manually in DataHub UI or via `datahub graphql` / acryl-datahub SDK.\n"
        "MCP add_tags will FAIL if tag URNs do not exist.\n"
        "Offline MidSphere demos do not require this bootstrap."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
