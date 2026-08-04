#!/usr/bin/env bash
# Soft validation of MidSphere env before demo.
set -euo pipefail

missing=0
need() {
  local k="$1"
  if [[ -z "${!k:-}" ]]; then
    echo "MISSING: $k"
    missing=1
  else
    echo "ok: $k"
  fi
}

need DATAHUB_GMS_URL
need DATAHUB_GMS_TOKEN

echo "TOOLS_IS_MUTATION_ENABLED=${TOOLS_IS_MUTATION_ENABLED:-unset (default false on MCP)}"
echo "DATAHUB_TIER=${DATAHUB_TIER:-oss}"

if [[ "${missing}" -ne 0 ]]; then
  echo "Copy .env.example → .env and fill required values."
  exit 1
fi
echo "Env check passed (mutations still require MCP process env)."
