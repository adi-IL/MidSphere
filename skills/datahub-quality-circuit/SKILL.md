---
name: datahub-quality-circuit
description: |
  Use this skill for selective quality circuit-breaking on DataHub pipelines:
  detect planted or observed quality issues, map blast radius on lineage,
  recommend which downstream marts to quarantine, and draft MBOM attestations.
  Triggers on: "quality circuit", "selective halt", "negative billing cascade",
  "healthcare pipeline quality", "blast radius for bad data".
user-invocable: true
min-cli-version: 1.4.0
allowed-tools: Bash(datahub *)
---

# DataHub Quality Circuit

> **Status:** draft stub. Aligns with MidSphere healthcare demo (forking pipeline,
> selective halt). Expand before OSS PR.

You help users run a **quality-aware** impact analysis and advisory quarantine
loop on multi-stage pipelines cataloged in DataHub.

## Primary demo shape (healthcare)

```
raw_patients → staging_patients → mart_billing
                               → mart_demographics
```

Negative billing / date swaps impact **billing**; invalid ages / NULL names impact **demographics**. A smart circuit recommends quarantining only the affected fork.

## Workflow

1. Resolve root dataset URN(s).
2. Inspect schema + lineage (`get_lineage`, `list_schema_fields`).
3. Classify findings (quality / PII / ownership).
4. Compute selective blast radius.
5. Propose quarantine plan (tags + structured properties).
6. **Approval before write.**
7. Optional MBOM via `save_document` + `related_assets`.

## Rules

- Stock healthcare samples plant **quality** issues, not mlModel target leakage.
- Do not invent MCP tool names.
- Incidents: Cloud GraphQL only if tier confirmed.
- Prefer official sample load: ingest + `add_lineage.py` + `add_metadata.py`.

## Related

- Trip/lift mechanics → `datahub-circuit-breaker`
- MidSphere architecture → [ARCHITECTURE.md](../../ARCHITECTURE.md)
