---
name: datahub-circuit-breaker
description: |
  Use this skill when the user wants to quarantine DataHub assets, check
  MidSphere-style gate status, lift circuit breaks, or apply advisory
  quarantine tags and structured properties. Triggers on: "quarantine",
  "circuit breaker", "lift quarantine", "gate status", "block this table",
  "unquarantine".
user-invocable: true
min-cli-version: 1.4.0
allowed-tools: Bash(datahub *)
---

# DataHub Circuit Breaker

> **Status:** draft stub for MidSphere OSS contribution. Expand with full
> workflow (resolve → plan → approve → execute → verify) before PR to
> `datahub-project/datahub-skills`.

You help users apply **advisory** circuit-breaker state in DataHub so humans
and MidSphere-aware agents can honor quarantine without claiming that MCP
auto-denies all readers.

## Capabilities

| Action | Mechanism |
| --- | --- |
| Trip | `add_tags` (`QUARANTINED`, `CIRCUIT_BROKEN`) + `add_structured_properties` (`gate_status=BLOCKED`) when mutations enabled |
| Status | `get_entities` / search for tags and structured properties |
| Lift | `remove_tags` + set `gate_status=LIFTED` |
| Incidents | GraphQL `raiseIncident` only on **DataHub Cloud** — never invent an MCP incident tool |

## Rules

1. Resolve and confirm entity URNs first.
2. Show current tags/properties before proposing changes.
3. **Always get approval before writes.**
4. Tags and structured property definitions must exist before assignment.
5. Prefer MCP mutation tools when `TOOLS_IS_MUTATION_ENABLED=true`; else `datahub graphql`.
6. Verify with a re-read after write.
7. Never claim global MCP read-blocking.

## Not this skill

| Need | Use |
| --- | --- |
| Quality cascade audit + MBOM | `datahub-quality-circuit` |
| Generic enrichment (owners, descriptions) | `/datahub-enrich` |
| Lineage exploration only | `/datahub-lineage` |

## References

- MidSphere [AGENTS.md](../../AGENTS.md)
- Official skill patterns under `resource/repositories/datahub-skills/`
