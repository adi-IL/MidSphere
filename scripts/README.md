# scripts/

Operator helpers for local DataHub + MidSphere bootstrap.

| Script | Purpose |
| --- | --- |
| `bootstrap_midsphere_metadata.py` | **Scaffold:** prints required tags/properties; does **not** auto-create them yet (use DataHub UI / `datahub graphql` / SDK) |
| `load_healthcare.sh` | Ingest + lineage + metadata for healthcare sample |
| `check_env.sh` | Soft check of GMS env vars (for live catalog demos) |

## Healthcare sample path

`load_healthcare.sh` expects sample datasets under:

`resource/repositories/static-assets/datasets/healthcare/`

That tree is **not shipped** in this public repo (local operator clone of [static-assets](https://github.com/datahub-project/static-assets)). Without it, the script exits with a clear error. The Command Center **still demos offline** via scenario packs.

Do **not** use `datahub datapack load healthcare` — healthcare loads via ingest scripts, not that datapack name.

## Tags / properties for live mutations

Before live `add_tags` / structured properties work, create (once) in DataHub:

- Tags: `QUARANTINED`, `CIRCUIT_BROKEN`, `MIDSPHERE_AUDIT` (and scenario tags like `PII_LEAK` / `PIPELINE_LAG` if used)
- Structured property: `midsphere.gate_status` (`OPEN` \| `BLOCKED` \| `LIFTED`), optional `midsphere.risk_score`, `midsphere.job_id`

Run `python scripts/bootstrap_midsphere_metadata.py` for the checklist.

See root [ARCHITECTURE.md](../ARCHITECTURE.md) for MCP contracts.
