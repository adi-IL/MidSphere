import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentName, AgentStatus, JobEvent } from "../../lib/types";
import { runKindTone, type RunKind } from "../../lib/status";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

interface AgentCardModel {
  name: AgentName;
  status: AgentStatus;
  accent: string;
  short: string;
}

export type InspectorTab =
  | "findings"
  | "gate"
  | "aspects"
  | "fix"
  | "mbom"
  | "rag"
  | "raw";

export interface JobMetrics {
  risk: number;
  findings: number;
  impacted: number;
  total: number;
  gate: "OPEN" | "BLOCKED" | "LIFTED" | "—";
}

interface Props {
  agents: AgentCardModel[];
  logs: JobEvent[];
  jobId: string;
  runKind?: RunKind;
  scanning?: boolean;
  metrics?: JobMetrics;
  onSelectAgent?: (name: AgentName | "ALL") => void;
  selectedAgent?: AgentName | "ALL";
  onClearLogs?: () => void;
  onOpenTab?: (tab: InspectorTab) => void;
}

const AGENT_SHORT: Record<AgentName, string> = {
  ContextSentinel: "Audit",
  CascadeAnalyzer: "Blast radius",
  CircuitBreaker: "Quarantine",
  FixArchitect: "Remediation",
  MBOMEngine: "Attestation",
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
  m = m.replace(/\s*\(demo_closed_loop; no live MCP call\)/gi, "");
  m = m.replace(/^sim\s+/i, "Simulated ");
  return m;
}

function parseArtifactRow(e: JobEvent): {
  headline: string;
  detail?: string;
  tab?: InspectorTab;
  cta?: string;
} | null {
  const m = e.message;
  const lower = m.toLowerCase();

  if (
    lower.includes("mbom ready") ||
    lower.includes("open inspector → mbom") ||
    lower.includes("open inspector -> mbom") ||
    e.kind === "MBOM" ||
    (lower.includes("examples/mboms/") && lower.includes("urn="))
  ) {
    return {
      headline: "MBOM ready",
      detail: "Open Attestation to review findings and lift criteria.",
      tab: "mbom",
      cta: "Open attestation",
    };
  }

  if (
    e.kind === "PR" ||
    lower.includes("dry_run path=") ||
    lower.includes("examples/prs/")
  ) {
    return {
      headline: "Fix artifact ready",
      detail: "Dry-run remediation available in Fix.",
      tab: "fix",
      cta: "Open fix",
    };
  }

  return null;
}

function formatTs(ts: string): string {
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

function gateTone(gate: string): string {
  if (gate === "BLOCKED") return "text-bad";
  if (gate === "LIFTED") return "text-warn";
  if (gate === "OPEN") return "text-good";
  return "text-mute";
}

export function SwarmSidebar({
  agents,
  logs,
  jobId,
  runKind = "Job",
  scanning = false,
  metrics,
  onSelectAgent,
  selectedAgent = "ALL",
  onClearLogs,
  onOpenTab,
}: Props) {
  const streamRef = useRef<HTMLDivElement>(null);
  const [localAgent, setLocalAgent] = useState<string>(selectedAgent);
  const [telemetryOpen, setTelemetryOpen] = useState(false);

  useEffect(() => {
    setLocalAgent(selectedAgent);
  }, [selectedAgent]);

  // Auto-open telemetry while a scan is running
  useEffect(() => {
    if (scanning) setTelemetryOpen(true);
  }, [scanning]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (isSystemNoise(log)) return false;
      if (localAgent === "ALL") return true;
      return log.agent === localAgent;
    });
  }, [logs, localAgent]);

  useEffect(() => {
    const el = streamRef.current;
    if (!el || !scanning) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, [filteredLogs.length, scanning]);

  const setFilter = (v: string) => {
    setLocalAgent(v);
    onSelectAgent?.(v as AgentName | "ALL");
  };

  const shortId =
    jobId.length > 18 ? `${jobId.slice(0, 8)}…${jobId.slice(-6)}` : jobId;

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-line bg-panel">
      {/* Header */}
      <div className="shrink-0 border-b border-line px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs font-medium text-mute">Pipeline</span>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] ${runKindTone(runKind)}`}
          >
            {runKind}
          </span>
        </div>
        <div
          className="mt-1 truncate font-mono text-2xs text-faint"
          title={jobId}
        >
          {shortId}
        </div>
      </div>

      {/* Metrics strip — single row */}
      {metrics && (
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2 font-mono text-2xs tabular-nums">
          <span
            className={
              metrics.risk >= 60
                ? "text-bad"
                : metrics.risk >= 40
                  ? "text-warn"
                  : "text-ink"
            }
            title="Risk"
          >
            {metrics.risk}
          </span>
          <span className="text-line2">·</span>
          <span className="text-mute" title="Findings">
            {metrics.findings}f
          </span>
          <span className="text-line2">·</span>
          <span className="text-mute" title="Impacted">
            {metrics.impacted}/{metrics.total}
          </span>
          <span className="text-line2">·</span>
          <span className={gateTone(metrics.gate)} title="Gate">
            {metrics.gate}
          </span>
        </div>
      )}

      {/* Pipeline stepper */}
      <div className="shrink-0 border-b border-line py-1">
        {agents.map((a, idx) => {
          const active = a.status === "RUNNING";
          const done = a.status === "DONE";
          const err = a.status === "ERROR";
          const selected = localAgent === a.name;

          const stageLogs = logs.filter((l) => l.agent === a.name);
          let totalLatency = 0;
          stageLogs.forEach((l) => {
            if (l.latency_ms) totalLatency += l.latency_ms;
          });
          const metricStr = totalLatency > 0 ? `${totalLatency}ms` : null;

          return (
            <button
              key={a.name}
              type="button"
              onClick={() => setFilter(selected ? "ALL" : a.name)}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                selected ? "bg-elevated" : "hover:bg-elevated/60"
              }`}
            >
              <div className="relative flex w-3 shrink-0 flex-col items-center">
                {idx < agents.length - 1 && (
                  <span
                    className="absolute top-3 h-[calc(100%+4px)] w-px bg-line"
                    aria-hidden
                  />
                )}
                <span
                  className={`relative z-[1] h-1.5 w-1.5 rounded-full ${
                    active
                      ? "bg-accent agent-pulse"
                      : done
                        ? "bg-good"
                        : err
                          ? "bg-bad"
                          : "bg-line2"
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`truncate text-2xs ${
                      active || selected ? "text-ink" : "text-mute"
                    }`}
                  >
                    {a.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-faint">
                    {metricStr ?? statusLabel(a.status)}
                  </span>
                </div>
                <div className="truncate text-[10px] text-faint">
                  {AGENT_SHORT[a.name] ?? a.short}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Telemetry disclosure */}
      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setTelemetryOpen((o) => !o)}
          className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2 text-2xs text-mute hover:text-ink"
        >
          <span className="inline-flex items-center gap-1.5">
            {telemetryOpen ? (
              <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
            ) : (
              <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
            )}
            Telemetry
            {scanning && (
              <span className="h-1.5 w-1.5 rounded-full bg-good agent-pulse" />
            )}
          </span>
          <span className="font-mono text-[10px] text-faint">
            {filteredLogs.length}
          </span>
        </button>

        {telemetryOpen && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-1 border-b border-line px-2 py-1">
              <select
                value={localAgent}
                onChange={(e) => setFilter(e.target.value)}
                className="min-w-0 flex-1 rounded border border-line bg-canvas px-1.5 py-0.5 text-[10px] text-mute focus:border-line2 focus:outline-none"
              >
                <option value="ALL">All stages</option>
                {agents.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
              {onClearLogs && (
                <button
                  type="button"
                  onClick={onClearLogs}
                  title="Clear logs"
                  className="rounded p-1 text-faint hover:text-ink"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                </button>
              )}
            </div>

            <div
              ref={streamRef}
              className="custom-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 font-mono text-[11px]"
            >
              {filteredLogs.length === 0 ? (
                <div className="py-6 text-center text-[10px] text-faint">
                  {logs.length === 0 ? "No events yet." : "No events for filter."}
                </div>
              ) : (
                filteredLogs.map((log, idx) => {
                  const artifact = parseArtifactRow(log);
                  return (
                    <div
                      key={`${log.ts}-${log.kind}-${idx}-${log.message.slice(0, 24)}`}
                      className="border-l border-line py-0.5 pl-2"
                    >
                      <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] text-faint">
                        <span className="tabular-nums">{formatTs(log.ts)}</span>
                        <span className="truncate text-mute">
                          {String(log.agent).replace(/([a-z])([A-Z])/g, "$1 $2")}
                        </span>
                      </div>
                      {artifact ? (
                        <div className="space-y-0.5">
                          <div className="leading-snug text-ink">
                            {artifact.headline}
                          </div>
                          {artifact.detail && (
                            <div className="text-[10px] leading-snug text-faint">
                              {artifact.detail}
                            </div>
                          )}
                          {artifact.tab && onOpenTab && (
                            <button
                              type="button"
                              onClick={() => onOpenTab(artifact.tab!)}
                              className="text-left text-[10px] text-accent hover:underline"
                            >
                              {artifact.cta ?? "Open"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="break-words leading-snug text-mute">
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
        )}
      </div>
    </aside>
  );
}
