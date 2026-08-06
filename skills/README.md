# skills/

Mirror of skills proposed upstream to [`datahub-project/datahub-skills`](https://github.com/datahub-project/datahub-skills).

| Skill | Intent |
| --- | --- |
| `datahub-circuit-breaker/` | Quarantine, lift, gate status, advisory tags/properties |
| `datahub-quality-circuit/` | Quality cascade + selective halt + MBOM narrative |

Each skill includes official-style YAML frontmatter (`name`, `description`, …), approval-before-write guidance, and tier checks (Cloud-only incidents — no invented MCP `create_incident`). See root [ARCHITECTURE.md](../ARCHITECTURE.md).

**Upstream PR (open):** [datahub-project/datahub-skills#88](https://github.com/datahub-project/datahub-skills/pull/88) — `feat: add circuit-breaker & quality-circuit skills for advisory quarantine`
