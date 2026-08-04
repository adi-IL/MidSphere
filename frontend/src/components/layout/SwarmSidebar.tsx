import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentName,
  AgentStatus,
  JobEvent,
  JobArtifact,
} from "../../lib/types";

interface AgentCardModel {
  name: AgentName;
  status: AgentStatus;
  accent: string;
  short: string;
}

interface Props {
  agents: AgentCardModel[];
  events: JobEvent[];
  jobId: string;
  job: JobArtifact;
  scanning?: boolean;
  /** When true, stream reveals over time (post-scan replay). */
  replayActive?: boolean;
  visibleEventCount?: number;
  onSelectAgent?: (name: AgentName | "ALL") => void;
  selectedAgent?: AgentName | "ALL";
}

type KindFilter = "ops" | "all" | "tools" | "findings" | "writes" | "system";

const AGENT_SHORT: Record<AgentName, string> = {
  ContextSentinel: "Audit quality signals",
  CascadeAnalyzer: "Blast radius + risk",
  CircuitBreaker: "Advisory quarantine",
  FixArchitect: "Remediation artifact",
  MBOMEngine: "Attestation / MBOM",
};

/** Stack-internal noise — hide from default operator view (quiet product). */
function isSystemNoise(e: JobEvent): boolean {
  const m = e.message.toLowerCase();
  if (e.kind !== "STATUS" && e.kind !== "ERROR") return false;
  return (
    m.includes("antigravity") ||
    m.includes("gemini") ||
    m.includes("workforce") ||
    m.includes("model=") ||
    m.includes("falling back") ||
    m.startsWith("antigravity_summary")
  );
}

function isToolLike(e: JobEvent): boolean {
  return e.kind === "TOOL" || e.message.includes("midsphere_");
}

function kindClass(kind: JobEvent["kind"]): string {
  switch (kind) {
    case "TOOL":
      return "text-accent";
    case "FIND":
      return "text-warn";
    case "SCORE":
      return "text-ink";
    case "WRITE":
      return "text-bad";
    case "PR":
    case "MBOM":
      return "text-good";
    case "ERROR":
      return "text-bad";
    default:
      return "text-faint";
  }
}

function statusLabel(s: AgentStatus): string {
  switch (s) {
    case "RUNNING":
      return "running";
    case "DONE":
      return "done";
    case "ERROR":
      return "error";
    case "WAITING_TOOL":
      return "waiting";
    default:
      return "idle";
  }
}

function modeChip(mode?: string): { label: string; tone: string } {
  if (mode === "live_mcp") return { label: "live", tone: "text-good border-good/30" };
  if (mode === "antigravity_closed_loop")
    return { label: "closed loop", tone: "text-mute border-line2" };
  if (mode === "demo_closed_loop")
    return { label: "demo", tone: "text-warn border-warn/30" };
  return { label: "job", tone: "text-mute border-line2" };
}

function extractBrief(events: JobEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const m = events[i].message;
    if (m.startsWith("antigravity_summary:")) {
      return m.replace(/^antigravity_summary:\s*/, "").trim();
    }
  }
  return null;
}

/** Operator-facing message: strip stack brand fluff. */
function displayMessage(e: JobEvent): string {
  let m = e.message;
  m = m.replace(/\s*\(antigravity custom tool\)/gi, "");
  m = m.replace(/^antigravity tool_call\s+/i, "tool ");
  m = m.replace(/^antigravity tool\s+/i, "");
  m = m.replace(/\s*\(demo_closed_loop; no live MCP call\)/gi, " · sim");
  return m;
}

export function SwarmSidebar({
  agents,
  events,
  jobId,
  job,
  scanning = false,
  replayActive = false,
  visibleEventCount,
  onSelectAgent,
  selectedAgent = "ALL",
}: Props) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("ops");
  const [briefOpen, setBriefOpen] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);

  const slice = useMemo(() => {
    if (typeof visibleEventCount === "number") {
      return events.slice(0, Math.min(visibleEventCount, events.length));
    }
    return events;
  }, [events, visibleEventCount]);

  const brief = useMemo(() => extractBrief(events), [events]);

  const filtered = useMemo(() => {
    return slice.filter((e) => {
      if (selectedAgent !== "ALL" && e.agent !== selectedAgent) return false;
      const sys = isSystemNoise(e);
      switch (kindFilter) {
        case "ops":
          return !sys;
        case "system":
          return sys;
        case "tools":
          return isToolLike(e) || e.kind === "TOOL";
        case "findings":
          return e.kind === "FIND" || e.kind === "SCORE";
        case "writes":
          return e.kind === "WRITE" || e.kind === "PR" || e.kind === "MBOM";
        case "all":
        default:
          return true;
      }
    });
  }, [slice, selectedAgent, kindFilter]);

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filtered.length, kindFilter, selectedAgent, scanning, replayActive]);

  const impacted = job.blast_radius.nodes.filter((n) => n.impacted).length;
  const total = job.blast_radius.nodes.length;
  const gate = job.quarantine?.gateStatus ?? "OPEN";
  const mode = modeChip(job.execution_mode);

  const FILTERS: { id: KindFilter; label: string }[] = [
    { id: "ops", label: "Ops" },
    { id: "tools", label: "Tools" },
    { id: "findings", label: "Findings" },
    { id: "writes", label: "Writes" },
    { id: "system", label: "System" },
    { id: "all", label: "All" },
  ];

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-line bg-panel">
      {/* Header */}
      <div className="shrink-0 border-b border-line px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-2xs font-mono uppercase tracking-widest text-faint">
            Swarm
          </div>
          <span
            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${mode.tone}`}
          >
            {mode.label}
          </span>
        </div>
        <div className="mt-1 truncate font-mono text-2xs text-mute" title={jobId}>
          {jobId}
        </div>
      </div>

      {/* Stage cards — compact checklist */}
      <div className="shrink-0 space-y-1 border-b border-line p-2">
        {agents.map((a) => {
          const active = a.status === "RUNNING";
          const done = a.status === "DONE";
          const err = a.status === "ERROR";
          const selected = selectedAgent === a.name;
          return (
            <button
              key={a.name}
              type="button"
              onClick={() =>
                onSelectAgent?.(selected ? "ALL" : a.name)
              }
              className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                selected
                  ? "border-line2 bg-elevated"
                  : "border-line bg-canvas hover:border-line2"
              }`}
            >
              <div className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                {active && (
                  <span
                    className="agent-ring absolute inset-0 rounded-full"
                    style={{ background: a.accent, opacity: 0.35 }}
                  />
                )}
                <span
                  className={`relative h-1.5 w-1.5 rounded-full ${
                    done || active ? "agent-pulse" : "opacity-40"
                  }`}
                  style={{ background: err ? "var(--bad)" : a.accent }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-ink">
                    {a.name}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-[10px] uppercase tracking-wide ${
                      active
                        ? "text-ink"
                        : done
                          ? "text-mute"
                          : err
                            ? "text-bad"
                            : "text-faint"
                    }`}
                  >
                    {statusLabel(a.status)}
                  </span>
                </div>
                <div className="truncate font-mono text-[10px] text-faint">
                  {AGENT_SHORT[a.name] ?? a.short}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Metrics grid (product truth, not model spend) */}
      <div className="shrink-0 border-b border-line px-3 py-2">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-faint">
          Job metrics
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric
            label="Risk"
            value={String(job.blast_radius.risk_score)}
            hot={job.blast_radius.risk_score >= 60}
          />
          <Metric label="Findings" value={String(job.findings.length)} />
          <Metric label="Impacted" value={`${impacted}/${total}`} />
          <Metric
            label="Gate"
            value={gate}
            hot={gate === "BLOCKED"}
            good={gate === "OPEN" || gate === "LIFTED"}
          />
        </div>
      </div>

      {/* Optional operator brief — collapsed, no vendor branding */}
      {brief && (
        <div className="shrink-0 border-b border-line px-3 py-2">
          <button
            type="button"
            onClick={() => setBriefOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
              Operator brief
            </span>
            <span className="text-2xs text-mute">{briefOpen ? "−" : "+"}</span>
          </button>
          {briefOpen && (
            <p className="mt-1.5 text-2xs leading-relaxed text-mute fade-in-up">
              {brief}
            </p>
          )}
        </div>
      )}

      {/* Activity terminal — fills remaining height */}
      <div className="mx-2 mb-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-line bg-canvas">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-elevated px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                scanning || replayActive
                  ? "bg-good agent-pulse"
                  : "bg-faint"
              }`}
            />
            <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
              Activity
            </span>
          </div>
          <select
            value={selectedAgent}
            onChange={(e) =>
              onSelectAgent?.(e.target.value as AgentName | "ALL")
            }
            className="max-w-[7.5rem] truncate rounded border border-line bg-canvas px-1 py-0.5 font-mono text-[10px] text-mute focus:border-line2 focus:outline-none"
            title="Filter by stage"
          >
            <option value="ALL">ALL</option>
            {agents.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ")[0]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line px-1.5 py-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setKindFilter(f.id)}
              className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                kindFilter === f.id
                  ? "bg-elevated text-ink"
                  : "text-faint hover:text-mute"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div
          ref={streamRef}
          className="custom-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 font-mono text-[11px] leading-snug"
        >
          {scanning && filtered.length === 0 && (
            <div className="py-6 text-center text-[10px] italic text-faint">
              {">"} scan in progress…
            </div>
          )}
          {!scanning && filtered.length === 0 && (
            <div className="py-6 text-center text-[10px] italic text-faint">
              {events.length === 0
                ? "> ready for scan."
                : kindFilter === "ops"
                  ? "> no operator events (try System or All)."
                  : "> no events for this filter."}
            </div>
          )}
          {filtered.map((e, i) => (
            <div
              key={`${e.ts}-${e.kind}-${i}`}
              className="border-l border-line pl-2 py-0.5 transition-colors hover:border-line2 fade-in-up"
            >
              <div className="mb-0.5 flex items-center justify-between gap-2 text-[9px] text-faint">
                <span className="tabular-nums">{e.ts}</span>
                <span className="truncate rounded border border-line bg-elevated px-1 py-px text-[8px] font-medium uppercase tracking-wide text-mute">
                  {String(e.agent).replace(/([a-z])([A-Z])/g, "$1 $2").split(" ")[0]}
                </span>
              </div>
              <div className="break-words text-mute">
                <span className={`font-medium ${kindClass(e.kind)}`}>
                  {e.kind}
                </span>{" "}
                <span className="text-ink/90">{displayMessage(e)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Metric({
  label,
  value,
  hot,
  good,
}: {
  label: string;
  value: string;
  hot?: boolean;
  good?: boolean;
}) {
  return (
    <div className="rounded border border-line bg-canvas px-2 py-1.5 font-mono">
      <div className="text-[9px] uppercase tracking-wider text-faint">{label}</div>
      <div
        className={`mt-0.5 text-xs font-medium tabular-nums ${
          hot ? "text-bad" : good ? "text-good" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
