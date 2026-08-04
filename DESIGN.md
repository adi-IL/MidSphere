# MidSphere design system

Command Center UI for the context circuit-breaker. Companion to ARCHITECTURE.md.

## 1. Philosophy

MidSphere is an intervention console, not a chat app and not a marketing site.

In under five seconds the operator should see:

1. What is broken (finding + severity)
2. Blast radius (who is downstream)
3. What the swarm stages did (telemetry)

Craft principles (aligned with calm product UI and Vercel design restraint): monochrome first, scarce color for state only, Geist typography, high density without noise, progressive disclosure.

## 2. Color (shipping)

Pure monochrome dark canvas. Not Deep Slate slate-950 teal glass.

| Token | Hex | Use |
| --- | --- | --- |
| canvas | `#000000` | App background |
| panel | `#0a0a0a` | Sidebars |
| elevated | `#111111` | Hover / chips |
| line | `#1a1a1a` | Borders |
| ink | `#ededed` | Primary text |
| mute | `#888888` | Secondary text |
| faint | `#666666` | Metadata |
| good | `#00c853` | Open / healthy |
| warn | `#f5a623` | Demo / analyzing |
| bad | `#ff4d4f` | Quarantine / impacted |
| accent | `#0070f3` | Focus / brand action |

Semantic color is scarce. Status always has a text label, not color alone.

## 3. Typography

| Role | Family |
| --- | --- |
| UI / prose | Geist Sans |
| Code / URNs / telemetry | Geist Mono |

## 4. Layout

Three-pane edge-to-edge Command Center:

1. Left: swarm stages + MCP telemetry stream
2. Center: lineage / blast-radius canvas (React Flow)
3. Right: inspector (findings, gate, fix, MBOM, raw)

Top bar: identity, connection status, risk chip, Run scan.

## 5. Telemetry display rules

- Show real MCP tool names when `kind=TOOL` (live path only)
- Show `sim ... (demo_closed_loop; no live MCP call)` for deterministic demo steps
- Never invent `datahub_*` tool names in the UI copy

## 6. Graph

- Impacted nodes: bad border, label `impacted`
- Open nodes: quiet border, label `open`
- Selective fork must remain readable (billing vs demographics)

## 7. Stack

React 18, Vite, TypeScript, Tailwind, React Flow, lucide-react (minimal), react-markdown.

Deploy: Vercel project `midsphere` from `frontend/` only.

## 8. Accessibility

- WCAG AA contrast on monochrome surfaces
- Visible focus rings
- `prefers-reduced-motion` disables edge animation
