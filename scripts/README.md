# scripts/

Operator helpers for local DataHub + MidSphere bootstrap.

| Script | Purpose |
| --- | --- |
| `bootstrap_midsphere_metadata.py` | Create tags + structured properties required by CircuitBreaker |
| `load_healthcare.sh` | Ingest + lineage + metadata for healthcare sample |
| `check_env.sh` | Validate required env vars before a demo |

Sample data lives under:

`resource/repositories/static-assets/datasets/healthcare/`

Do **not** use `datahub datapack load healthcare` — that is not an official datapack for this repo’s path. Prefer `./scripts/load_healthcare.sh` when GMS is available.

See [AGENTS.md](../AGENTS.md) §8 Sample data.
