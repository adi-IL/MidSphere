import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentName, AgentStatus, JobEvent } from "../../lib/types";

interface AgentCardModel {
  name: AgentName;
  status: AgentStatus;
  accent: string;
  short: string;
}

export type InspectorTab = "findings" | "gate" | "fix" | "mbom" | "raw";

interface Props {
  agents: AgentCardModel[];
  /** Newest-first terminal stream (Sentinel-style). */
  logs: JobEvent[];
  jobId: string;
  modeLabel?: string;
  scanning?: boolean;
  onSelectAgent?: (name: AgentName | "ALL") => void;
  selectedAgent?: AgentName | "ALL";
  onClearLogs?: () => void;
  /** Open inspector tab (e.g. from MBOM/PR log rows). */
  onOpenTab?: (tab: InspectorTab) => void;
}

const AGENT_SHORT: Record<AgentName, string> = {
  ContextSentinel: "Audit quality signals",
  CascadeAnalyzer: "Blast radius + risk",
  CircuitBreaker: "Advisory quarantine",
  FixArchitect: "Remediation artifact",
  MBOMEngine: "Attestation / MBOM",
};

function isSystemNoise(e: JobEvent): boolean {
  const m = e.message.toLowerCase();
  if (e.kind !== "STATUS" && e.kind !== "ERROR") return false;
  return (
    m.includes("antigravity") ||
    m.includes("gemini") ||
    m.includes("workforce") ||
    m.includes("model=") ||
    m.startsWith("antigravity_summary")
  );
}

function displayMessage(e: JobEvent): string {
  let m = e.message;
  m = m.replace(/\s*\(antigravity custom tool\)/gi, "");
  m = m.replace(/^antigravity tool_call\s+/i, "tool ");
  m = m.replace(/^antigravity tool\s+/i, "");
  m = m.replace(/\s*\(demo_closed_loop; no live MCP call\)/gi, " · sim");
  return m;
}

/** Human-facing artifact rows (MBOM / PR) — not raw path dumps. */
function parseArtifactRow(e: JobEvent): {
  headline: string;
  detail?: string;
  tab?: InspectorTab;
  cta?: string;
} | null {
  const m = e.message;
  const lower = m.toLowerCase();

  // Explicit CTA lines + raw mbom artifact path=... urn=...
  if (
    lower.includes("mbom ready") ||
    lower.includes("open inspector → mbom") ||
    lower.includes("open inspector -> mbom")
  ) {
    return {
      headline: "MBOM ready — audit attestation for this job",
      detail: "Open Inspector → MBOM to read findings, risk, quarantine, and lift criteria.",
      tab: "mbom",
      cta: "Open MBOM review →",
    };
  }
  if (
    e.kind === "MBOM" ||
    lower.includes("mbom artifact") ||
    (lower.includes("examples/mboms/") && lower.includes("urn="))
  ) {
    const pathMatch = m.match(/path[=:]?\s*(\S+\.md)/i);
    const urnMatch = m.match(/urn=(urn:li:document:\S+)/i);
    const path = pathMatch?.[1];
    const urn = urnMatch?.[1];
    return {
      headline: "MBOM ready — audit attestation for this job",
      detail: [
        path ? `example file: ${path}` : null,
        urn ? `doc id: ${urn}` : null,
        "offline demo · open Inspector → MBOM to review",
      ]
        .filter(Boolean)
        .join(" · "),
      tab: "mbom",
      cta: "Open MBOM review →",
    };
  }

  // dry_run path=examples/prs/...
  if (
    e.kind === "PR" ||
    lower.includes("dry_run path=") ||
    lower.includes("examples/prs/")
  ) {
    const pathMatch = m.match(/path[=:]?\s*(\S+\.diff)/i);
    const path = pathMatch?.[1];
    return {
      headline: "Fix artifact ready — remediation diff (dry-run)",
      detail: [
        path ? `example file: ${path}` : null,
        "open Inspector → Fix to review",
      ]
        .filter(Boolean)
        .join(" · "),
      tab: "fix",
      cta: "Open Fix review →",
    };
  }

  return null;
}

function formatTs(ts: string): string {
  // Accept "HH:MM:SS.mmm" or ISO
  if (/^\d{2}:\d{2}:\d{2}/.test(ts)) return ts.slice(0, 8);
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts.slice(0, 8);
  }
}

function agentBadge(agent: string): string {
  return String(agent)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")[0]
    .toUpperCase();
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

function modeTone(label: string): string {
  if (label === "live") return "text-good border-good/30";
  if (label === "demo") return "text-warn border-warn/30";
  return "text-mute border-line2";
}

export function SwarmSidebar({
  agents,
  logs,
  jobId,
  modeLabel = "closed loop",
  scanning = false,
  onSelectAgent,
  selectedAgent = "ALL",
  onClearLogs,
  onOpenTab,
}: Props) {
  const streamRef = useRef<HTMLDivElement>(null);
  const [localAgent, setLocalAgent] = useState<string>(selectedAgent);

  useEffect(() => {
    setLocalAgent(selectedAgent);
  }, [selectedAgent]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (isSystemNoise(log)) return false;
      if (localAgent === "ALL") return true;
      return log.agent === localAgent;
    });
  }, [logs, localAgent]);

  // Sentinel keeps newest at top (prepend) — pin scroll to top on new logs while live
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    if (scanning) {
      el.scrollTop = 0;
    }
  }, [filteredLogs.length, scanning]);

  const setFilter = (v: string) => {
    setLocalAgent(v);
    onSelectAgent?.(v as AgentName | "ALL");
  };

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-line bg-panel">
      {/* Header */}
      <div className="shrink-0 border-b border-line px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-faint">
            Swarm
          </div>
          <span
            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${modeTone(modeLabel)}`}
          >
            {modeLabel}
          </span>
        </div>
        <div className="mt-1 truncate font-mono text-2xs text-mute" title={jobId}>
          {jobId}
        </div>
      </div>

      {/* Stage cards — compact */}
      <div className="shrink-0 space-y-1 border-b border-line p-2">
        {agents.map((a) => {
          const active = a.status === "RUNNING";
          const done = a.status === "DONE";
          const err = a.status === "ERROR";
          const selected = localAgent === a.name;
          return (
            <button
              key={a.name}
              type="button"
              onClick={() => setFilter(selected ? "ALL" : a.name)}
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

      {/* Terminal Log — flex-1 fills rest (Sentinel pattern) */}
      <div className="mx-2 mb-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-canvas">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-elevated px-3 py-2">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                scanning ? "bg-good agent-pulse" : "bg-good/80 agent-pulse"
              }`}
            />
            <span className="font-mono text-[10px] uppercase tracking-wider text-mute">
              Terminal Log
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={localAgent}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-mute focus:border-ink focus:outline-none"
            >
              <option value="ALL">ALL</option>
              {agents.map((a) => (
                <option key={a.name} value={a.name}>
                  {agentBadge(a.name)}
                </option>
              ))}
            </select>
            {onClearLogs && (
              <button
                type="button"
                onClick={onClearLogs}
                title="Clear Logs"
                className="rounded p-1 text-mute transition-colors hover:bg-canvas hover:text-ink"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div
          ref={streamRef}
          className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5 font-mono text-[11px]"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-4 text-center text-[10px] italic text-faint">
              {logs.length === 0
                ? "> System initialized. Ready."
                : "> No logs for selected agent."}
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const artifact = parseArtifactRow(log);
              return (
                <div
                  key={`${log.ts}-${log.kind}-${idx}-${log.message.slice(0, 24)}`}
                  className={`border-l py-0.5 pl-2 transition-colors ${
                    artifact
                      ? "border-good/40 hover:border-good"
                      : "border-line hover:border-ink/40"
                  }`}
                >
                  <div className="mb-0.5 flex items-center justify-between gap-2 text-[9px] text-faint">
                    <span className="tabular-nums">{formatTs(log.ts)}</span>
                    <span className="rounded border border-line bg-elevated px-1 py-px text-[8px] font-bold uppercase tracking-wide text-mute">
                      {agentBadge(String(log.agent))}
                    </span>
                  </div>
                  {artifact ? (
                    <div className="space-y-1">
                      <div className="break-words leading-snug text-ink/90">
                        {artifact.headline}
                      </div>
                      {artifact.detail && (
                        <div className="break-all text-[10px] leading-snug text-faint">
                          {artifact.detail}
                        </div>
                      )}
                      {artifact.tab && onOpenTab && (
                        <button
                          type="button"
                          onClick={() => onOpenTab(artifact.tab!)}
                          className="text-left text-[10px] font-medium text-accent hover:underline"
                        >
                          {artifact.cta ?? "Open in Inspector →"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="break-words leading-snug text-ink/90">
                      {log.kind !== "STATUS" && (
                        <span className="mr-1 text-faint">{log.kind}</span>
                      )}
                      {displayMessage(log)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
