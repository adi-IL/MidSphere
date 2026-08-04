# MidSphere Design System

**Command Center UI/UX for the Autonomous Context Circuit-Breaker**  
*Companion to ARCHITECTURE.md · universal redesign*

| Document | Role |
| --- | --- |
| ARCHITECTURE.md | Product thesis, system design, DataHub contracts |
| **DESIGN.md** (this file) | Visual system, layout, components, motion, demo UX |
| AGENTS.md | Agent contracts, ops, verification |

**Source-of-truth rule:** This file owns all visual decisions. Junior docs conflicted (pure black Vercel zinc vs Deep Slate). **Deep Slate + circuit semantics** wins—enterprise observability, not generic “hacker black.”

---

## 1. Design philosophy

### 1.1 Product metaphor: Enterprise Mission Control

MidSphere is not a chat app and not a passive analytics dashboard. It is an **intervention console**.

When a data platform engineer opens it, three questions must be answerable in under five seconds:

1. **What is broken?** (finding + severity)  
2. **What is the blast radius?** (who/what is downstream)  
3. **What is the swarm doing about it?** (quarantine, PR, MBOM)

The visual language borrows:

| Inspiration | Borrow |
| --- | --- |
| DataHub / Datadog topology | Lineage spatial awareness |
| Linear / VS Code | Actionable code diffs, dense but calm UI |
| Status pages / SRE runbooks | Clear severity, reversibility, audit trail |

### 1.2 Principles

| Principle | Implementation |
| --- | --- |
| **Authority** | Restrained surfaces; semantic color only for state |
| **Precision** | Monospace for URNs, SQL, tool args; no decorative noise |
| **Trust** | Show agent work (tools, latency, findings)—never hide mutations |
| **Reversibility** | Lift Quarantine is first-class, same prominence as Trip Breaker |
| **Progressive disclosure** | Risk + graph first; SQL/JSON only in inspector |
| **Judge offline-ability** | Screenshots and static graph snapshots in `examples/ui/` |

### 1.3 Accessibility

- WCAG AA contrast on Slate surfaces (avoid pure white on pure black)  
- Status never color-only: always pair with icon + label (`QUARANTINED`, `HEALTHY`)  
- Focus rings on all interactive graph nodes and inspector tabs  
- Prefer `prefers-reduced-motion`: disable stream animations, keep state changes instant  

---

## 2. Color system

### 2.1 Surfaces (Deep Slate)

| Token | Hex | Use |
| --- | --- | --- |
| `--bg-app` | `#0f172a` | App background (Slate 950) |
| `--bg-panel` | `#1e293b` | Cards, sidebars (Slate 800) |
| `--bg-panel-elevated` | `#334155` | Hover / elevated chips (Slate 700) |
| `--border-subtle` | `#334155` | Default borders |
| `--border-strong` | `#475569` | Active panels |

Optional glass: `backdrop-blur-md` + `bg-slate-900/70` on floating toasts and modals—not on every card (avoid generic “glassmorphism spam”).

### 2.2 Typography colors

| Token | Hex | Use |
| --- | --- | --- |
| `--text-primary` | `#f8fafc` | Titles, primary labels |
| `--text-secondary` | `#94a3b8` | Metadata, timestamps |
| `--text-tertiary` | `#64748b` | Disabled / low emphasis |

### 2.3 Circuit semantic palette

| State | Token | Hex | Meaning |
| --- | --- | --- | --- |
| Healthy / flowing | `--circuit-healthy` | `#34d399` (Emerald 400) | Certified, open gate, live stream |
| Analyzing / warn | `--circuit-warn` | `#fbbf24` (Amber 400) | Sentinel finding, not yet quarantined |
| Quarantined / broken | `--circuit-broken` | `#f43f5e` (Rose 500) | Tag `QUARANTINED` / `gate_status=BLOCKED` |
| Neutral / halted edge | `--circuit-idle` | `#64748b` | Downstream of break—animation stopped |
| Brand / DataHub | `--brand-datahub` | `#1890ff` | Links to DataHub entities, primary CTAs |
| Info / agent active | `--agent-pulse` | `#38bdf8` (Sky 400) | Active agent thinking pulse |

**Do not use** pure `#ef4444` red-on-black as the only quarantine cue—Rose 500 on Slate 950 passes contrast more cleanly and matches the “circuit” metaphor.

### 2.4 Agent identity colors (telemetry strip)

Stable per-agent accents so the swarm HUD is scannable:

| Agent | Accent |
| --- | --- |
| ContextSentinel | Sky `#38bdf8` |
| CascadeAnalyzer | Violet `#a78bfa` |
| CircuitBreaker | Rose `#f43f5e` |
| FixArchitect | Emerald `#34d399` |
| MBOMEngine | Amber `#fbbf24` |

---

## 3. Typography

| Role | Family | Weight | Notes |
| --- | --- | --- | --- |
| UI / prose | **Inter** (or Geist if already in template) | 400–600 | Nav, MBOM body, buttons |
| Code / data | **JetBrains Mono** (or Fira Code) | 400–500 | URNs, SQL, tool logs, diffs; ligatures **on** for diffs only |

Scale (Tailwind-friendly):

| Name | Size | Use |
| --- | --- | --- |
| `text-xs` | 12px | Telemetry timestamps, hop badges |
| `text-sm` | 14px | Secondary UI, table cells |
| `text-base` | 16px | Body |
| `text-lg` | 18px | Panel titles |
| `text-xl` / `text-2xl` | 20–24px | Risk score hero number |

URNs always truncate with middle ellipsis in graph labels; full URN in inspector + copy button.

---

## 4. Layout: three-pane Command Center

Abandon top-nav SaaS chrome. Edge-to-edge workspace:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: MidSphere · env badge · DataHub connection · Scan CTA · user        │
├────────────┬─────────────────────────────────────────────┬───────────────────┤
│ LEFT       │ CENTER                                      │ RIGHT             │
│ 280–320px  │ flex-1                                      │ 360–420px         │
│            │                                             │                   │
│ Swarm HUD  │ Lineage / Blast-Radius Canvas               │ Inspector Drawer  │
│ Agents     │                                             │ Tabs:             │
│ Job queue  │  [pan/zoom]                                 │  Findings         │
│ Spend/tok  │                                             │  Gate / Tags      │
│            │                                             │  PR Diff          │
│ Nav        │                                             │  MBOM             │
│ History    │                                             │  Raw JSON         │
│            │                                             │                   │
│ Terminal   │                                             │ Actions           │
│ (collaps.) │                                             │ Trip / Lift / PR  │
└────────────┴─────────────────────────────────────────────┴───────────────────┘
```

### 4.1 Top bar

- Wordmark: **MidSphere** + small “powered by DataHub” link (`--brand-datahub`)  
- Connection pill: `DataHub · OSS local` / `Cloud · tenant` / `Disconnected` (red)  
- Primary CTA: **Run Scan** (opens target URN picker)  
- Secondary: **Open in DataHub** for selected node  

### 4.2 Left — Swarm Controller

**Live Agent Telemetry HUD**

Each agent card:

```
┌─────────────────────────────────────┐
│ ● ContextSentinel        RUNNING    │  ← accent bar left
│ get_lineage · 1.2s · 2.1k tok       │
│ Finding: NEGATIVE_BILLING (HIGH)    │
└─────────────────────────────────────┘
```

States: `IDLE` | `RUNNING` | `WAITING_TOOL` | `DONE` | `ERROR`

**Job list:** recent scans with risk score chip and status.

**Collapsed terminal** at bottom of left pane: last 50 structured log lines (expand to modal for full stream).

### 4.3 Center — Topological Theater

Infinite pan/zoom canvas (start with **2D React Flow**—ship reliability over 3D novelty).

**Node types:**

| Type | Shape | Content |
| --- | --- | --- |
| Dataset | Rounded rect | name, platform icon, stage badge (raw/staging/mart) |
| Dashboard / Chart | Soft diamond | name, tool |
| ML Model *(if present)* | Hexagon | model name |
| Cluster / hop group | Group frame | when > 20 nodes |

**Edge semantics:**

| Gate state | Edge look |
| --- | --- |
| Healthy | Emerald dashed pulse along path |
| Analyzing | Amber pulse on path under audit |
| Quarantined source | Rose node halo; **downstream edges freeze** to `--circuit-idle` (no motion) |

**Node halo** intensity maps to risk score (0–100): low = thin emerald, high = thick rose.

**Focus mode:** click node → dim unrelated graph to 30% opacity; highlight cascade path (upstream root cause + downstream impact).

**Empty / loading:** skeleton graph with “Waiting for CascadeAnalyzer…”—never a blank void.

### 4.4 Right — Inspector (Action Console)

Tabs (keyboard 1–5):

1. **Findings** — severity, type, evidence, column paths  
2. **Gate** — current tags, structured props, lift criteria, Consumer Gate preview  
3. **Fix / PR** — split diff + “Open PR” / “View on GitHub”  
4. **MBOM** — rendered markdown (Notion-like), “Published to DataHub” badge + doc URN  
5. **Raw** — collapsed JSON artifacts (AuditReport, BlastRadiusMatrix)

Sticky footer actions:

| Action | Style | Notes |
| --- | --- | --- |
| Trip Circuit | Rose filled | Confirms if auto-trip disabled |
| Lift Quarantine | Ghost / outline | Always available when BLOCKED |
| Approve & Open PR | Emerald filled | FixArchitect |
| Copy URN | Icon | |

---

## 5. Key components

### 5.1 Risk Scorecard

Hero metric in inspector header or floating on canvas:

```
┌──────────────────────────┐
│  RISK                     │
│  87                       │  ← tabular nums, text-4xl
│  HIGH · 6 entities        │
│  ████████░░  selective    │
└──────────────────────────┘
```

Tooltip shows formula factors (link ARCHITECTURE §4.2)—builds judge trust.

### 5.2 FixArchitect Diff Terminal

IDE-grade split pane:

- Left: current SQL / dbt from DataHub queries or stub  
- Right: proposed fix  
- Line-level green/red markers  
- File tabs if multi-file PR  
- Footer: branch name, commit message preview, **Approve & Open PR**

If GitHub token missing: still render full diff; button becomes **Download patch** and copy path to `examples/prs/…`.

### 5.3 Live Swarm Telemetry stream

Structured lines (not free-form LLM dumps):

```
14:02:01.012  ContextSentinel  TOOL   get_lineage  urn=… max_hops=2  240ms
14:02:01.310  ContextSentinel  FIND   NEGATIVE_BILLING  severity=HIGH  entity=mart_billing
14:02:02.100  CascadeAnalyzer  TOOL   get_lineage  downstream  max_hops=3
14:02:03.400  CascadeAnalyzer  SCORE  risk=87  impacted=2/4  selective=true
14:02:04.010  CircuitBreaker   TOOL   add_tags  QUARANTINED  entities=2
14:02:04.400  CircuitBreaker   WRITE  gate_status=BLOCKED  ok
```

UI maps `TOOL` / `FIND` / `SCORE` / `WRITE` / `ERROR` to icons.  
**Honest tool names only** (`get_lineage`, `add_tags`, `save_document`)—never `datahub_*` prefixes.

### 5.4 MBOM Viewer

- Markdown render with GFM tables  
- Header chip: document type + DataHub doc URN (link)  
- Sections order fixed for demos: Summary → Findings → Blast Radius → Quarantine → Remediation PR → Lift Criteria  
- Print/export button for `examples/mboms/`

### 5.5 Consumer Gate preview panel

Small “what would an agent see?” card:

| Mode | UI |
| --- | --- |
| OPEN | Green: full schema snippet + “context allowed” |
| BLOCKED | Rose: redacted schema, reason, PR link, MBOM link |

This is the **honest demable circuit break**—show it in the video.

### 5.6 Scan target picker

Modal:

- Search via backend → DataHub `search`  
- Recent healthcare URNs pre-seeded for demo  
- Multi-select optional (v1: single root URN)  
- Toggle: **Auto-trip circuit** (default on for demo) / dry-run audit only  

### 5.7 Toasts

Bottom-right, non-blocking, 5s:

- “Quarantine applied · 2 entities”  
- “MBOM saved · urn:li:document:…”  
- “PR opened · #42”  
- Errors sticky until dismiss  

---

## 6. Motion & micro-interactions

| Interaction | Behavior |
| --- | --- |
| Agent active | Slow opacity pulse (2s) on accent bar |
| Edge healthy | CSS dash-offset animation 1.5s loop |
| Circuit trip | 300ms: node halo rose, edges freeze, toast |
| Focus path | 200ms opacity transition on non-path nodes |
| Inspector open | 150ms slide from right |
| Reduced motion | All animations → instant state swap |

No confetti. No particle explosions. This is an SRE tool aesthetic.

---

## 7. Information architecture & routes

| Route | Purpose |
| --- | --- |
| `/` | Command Center (default job or empty state) |
| `/jobs/:id` | Specific scan session |
| `/history` | Past jobs list |
| `/settings` | DataHub URL (read-only display), gate policy, model labels |
| `/demo` | Scripted walkthrough mode for judges (auto-plays healthcare) |

Deep-link: `/jobs/:id?node=<urn>` opens inspector on that node.

---

## 8. Frontend stack & component map

| Concern | Choice |
| --- | --- |
| Framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + CSS variables for tokens |
| Graph | React Flow (xyflow) v11+ |
| Diff | `react-diff-viewer-continued` or Monaco diff |
| Markdown | `react-markdown` + `remark-gfm` |
| Icons | Lucide |
| State | Zustand or TanStack Query for server state |
| Realtime | EventSource (SSE) from FastAPI `/jobs/:id/stream` |
| Deploy | Vercel from `frontend/` only |

### 8.1 Suggested component tree

```
src/
  app/
  components/
    layout/TopBar.tsx
    layout/SwarmSidebar.tsx
    layout/InspectorDrawer.tsx
    graph/LineageCanvas.tsx
    graph/DatasetNode.tsx
    graph/CircuitEdge.tsx
    swarm/AgentCard.tsx
    swarm/TelemetryTerminal.tsx
    inspect/FindingsTab.tsx
    inspect/GateTab.tsx
    inspect/DiffTab.tsx
    inspect/MbomTab.tsx
    inspect/GatePreview.tsx
    score/RiskScorecard.tsx
    scan/TargetPicker.tsx
  lib/
    tokens.css
    types/artifacts.ts   # shared with backend OpenAPI types
    api/client.ts
  pages/
    CommandCenter.tsx
    JobHistory.tsx
    Settings.tsx
    DemoMode.tsx
```

### 8.2 Shared artifact types (UI ↔ API)

Align names with backend (see AGENTS.md):

```ts
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface AuditFinding {
  id: string;
  type: string;
  severity: Severity;
  entityUrn: string;
  columnPath?: string;
  evidence: string;
  rationale: string;
}

interface BlastNode {
  urn: string;
  name: string;
  hop: number;
  impacted: boolean;
  reason?: string;
}

interface QuarantineReceipt {
  entityUrns: string[];
  tagsApplied: string[];
  properties: Record<string, string>;
  incidentUrn?: string; // Cloud only
  gateStatus: "OPEN" | "BLOCKED" | "LIFTED";
}

interface JobEvent {
  ts: string;
  agent: string;
  kind: "TOOL" | "FIND" | "SCORE" | "WRITE" | "PR" | "MBOM" | "ERROR" | "STATUS";
  message: string;
  payload?: unknown;
}
```

---

## 9. Empty, error, and offline states

| State | UX |
| --- | --- |
| No DataHub | Full-page connect instructions; disable Scan |
| Mutations disabled | Banner: “Write-back off — audit only”; still show findings |
| Agent error | Agent card ERROR + retry job |
| Graph empty after scan | “No lineage edges—check ingest/add_lineage.py” |
| Judge offline | Demo mode loads `examples/jobs/healthcare-sample.json` |

---

## 10. Demo UX script (maps to &lt;3 min video)

Storyboard for judges and video:

| Time | Screen | Action |
| --- | --- | --- |
| 0:00–0:20 | Title + thesis | “Context entropy breaks agents. MidSphere trips the circuit inside DataHub.” |
| 0:20–0:45 | DataHub UI | Healthcare lineage fork visible |
| 0:45–1:30 | Command Center | Run Scan → swarm HUD tools stream with **real MCP names** |
| 1:30–1:55 | Graph | Selective rose on `mart_billing`; demographics stays emerald |
| 1:55–2:20 | Gate preview | BLOCKED context response |
| 2:20–2:40 | Diff + PR | FixArchitect removes/filters bad rows |
| 2:40–2:55 | MBOM in DataHub | Document linked via related assets |
| 2:55–3:00 | Close | Repo + live demo URL |

Record at 1080p; zoom inspector for URN readability.

---

## 11. Offline judge artifacts (`examples/`)

| Path | Content |
| --- | --- |
| `examples/ui/command-center.png` | Full three-pane screenshot |
| `examples/ui/blast-radius.png` | Selective quarantine graph |
| `examples/ui/gate-blocked.png` | Consumer Gate panel |
| `examples/mboms/healthcare-billing-mbom.md` | Full MBOM markdown |
| `examples/prs/fix-negative-billing.diff` | Generated fix |
| `examples/jobs/healthcare-sample.json` | Full job artifact for Demo Mode |
| `examples/telemetry/swarm-log.txt` | Sample tool stream |

README should link these prominently—“Judges: review without running.”

---

## 12. What we drop from junior design.md

| Dropped / softened | Why |
| --- | --- |
| Mandatory “3D” lineage | 2D React Flow is more reliable for hackathon E2E; 3D is optional polish |
| Pure black `#000` + zinc-only palette | Conflicts with Deep Slate system; worse long-session contrast |
| Visual “data flow halted” implying platform-wide MCP denial | Show freeze on **our** graph + Gate preview; copy must say **advisory + MidSphere gate** |
| Invented tool names in telemetry mockups | Use real MCP tool names only |

---

## 13. Implementation checklist (frontend)

- [ ] Token CSS variables match §2  
- [ ] Three-pane shell responsive down to 1280px (stack inspector below canvas on smaller)  
- [ ] SSE stream renders JobEvents without dropping  
- [ ] Graph supports healthcare 4-node fork + expansion  
- [ ] Diff viewer works with example files offline  
- [ ] Demo Mode loads sample JSON with zero backend  
- [ ] Vercel deploy from `frontend/` only  
- [ ] Lighthouse / axe: no critical a11y on primary flows  

---

*MidSphere — Design. Calm authority. Semantic circuits. Judge-scorable screens.*
