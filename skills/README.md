# skills/

Local mirrors of skills proposed upstream to
[`datahub-project/datahub-skills`](https://github.com/datahub-project/datahub-skills).

| Skill | Intent |
| --- | --- |
| `datahub-circuit-breaker/` | Advisory quarantine, lift, gate status, tags and structured properties |
| `datahub-quality-circuit/` | Quality cascade, selective halt, MBOM-style attestation narrative |

Each skill includes YAML frontmatter (`name`, `description`), approval-before-write guidance, and tier checks. Do not invent an MCP `create_incident` tool. Incidents, where used, follow DataHub Cloud GraphQL conventions only.

See root [ARCHITECTURE.md](../ARCHITECTURE.md).

**Upstream PR:** [datahub-project/datahub-skills#88](https://github.com/datahub-project/datahub-skills/pull/88)
