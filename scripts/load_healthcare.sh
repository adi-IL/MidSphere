#!/usr/bin/env bash
# Load official healthcare sample into a running DataHub GMS.
# Requires: datahub CLI, DATAHUB_GMS_URL (+ token as configured for CLI)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HC="${ROOT}/resource/repositories/static-assets/datasets/healthcare"

if [[ ! -d "${HC}" ]]; then
  echo "Healthcare sample not found at ${HC}"
  echo "Ensure resource/repositories/static-assets is present."
  exit 1
fi

echo "==> Ingest healthcare tables"
( cd "${HC}" && datahub ingest -c ingest.yaml )

echo "==> Add lineage"
( cd "${HC}" && python add_lineage.py )

echo "==> Add metadata (tags, glossary, ownership)"
( cd "${HC}" && python add_metadata.py )

echo "==> Bootstrap MidSphere tags/properties (if script available)"
if [[ -f "${ROOT}/scripts/bootstrap_midsphere_metadata.py" ]]; then
  python "${ROOT}/scripts/bootstrap_midsphere_metadata.py" || true
fi

echo "Done. Open DataHub UI and verify raw_patients → staging → marts lineage."
