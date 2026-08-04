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
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="border-b border-line px-3 py-3">
        <div className="text-2xs uppercase tracking-wide text-faint">
          Swarm
        </div>
        <div className="mt-1 truncate font-mono text-2xs text-mute">
          {jobId}
        </div>
      </div>

      <div className="space-y-1.5 overflow-y-auto p-2 scrollbar-thin">
        {agents.map((a) => (
          <div
            key={a.name}
            className="flex items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-2"
          >
            <span
              className={`h-6 w-0.5 rounded-full ${a.status === "DONE" || a.status === "RUNNING" ? "agent-pulse" : "opacity-40"}`}
              style={{ background: a.accent }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-ink">
                {a.name}
              </div>
              <div className="text-2xs text-mute">{a.status}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-line">
        <div className="px-3 py-2 text-2xs uppercase tracking-wide text-faint">
          MCP telemetry
        </div>
        <div className="max-h-52 overflow-y-auto px-3 pb-3 font-mono text-2xs leading-relaxed text-mute scrollbar-thin">
          {events.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="mb-1.5">
              <span className="text-faint">{e.ts}</span>{" "}
              <span className="text-ink">{e.agent}</span>{" "}
              <span className="text-accent">{e.kind}</span> {e.message}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
