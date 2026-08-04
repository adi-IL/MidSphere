import type { AgentName, AgentStatus, JobEvent } from "../../lib/types";

interface AgentCardModel {
  name: AgentName;
  status: AgentStatus;
  accent: string;
}

interface Props {
  agents: AgentCardModel[];
  events: JobEvent[];
  jobId: string;
}

export function SwarmSidebar({ agents, events, jobId }: Props) {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-elevated bg-panel">
      <div className="border-b border-elevated px-3 py-3">
        <div className="text-[11px] uppercase tracking-wider text-dim">
          Swarm Controller
        </div>
        <div className="mt-1 truncate font-mono text-xs text-muted">
          job {jobId}
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto p-3 scrollbar-thin">
        {agents.map((a) => (
          <div
            key={a.name}
            className="rounded-lg border border-elevated bg-app/50 p-2.5 shadow-panel"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-8 w-1 rounded-full ${a.status === "RUNNING" || a.status === "DONE" ? "agent-pulse" : ""}`}
                style={{ background: a.accent }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.name}</div>
                <div className="text-[11px] text-muted">{a.status}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-elevated">
        <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-dim">
          Telemetry
        </div>
        <div className="max-h-48 overflow-y-auto px-3 pb-3 font-mono text-[11px] leading-relaxed text-muted scrollbar-thin">
          {events.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="mb-1">
              <span className="text-dim">{e.ts}</span>{" "}
              <span className="text-pulse">{e.agent}</span>{" "}
              <span className="text-warn">{e.kind}</span> {e.message}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
