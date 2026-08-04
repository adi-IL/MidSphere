import { useEffect, useMemo, useState } from "react";
import { TopBar } from "./components/layout/TopBar";
import { SwarmSidebar } from "./components/layout/SwarmSidebar";
import { InspectorDrawer } from "./components/layout/InspectorDrawer";
import { LineageCanvas } from "./components/graph/LineageCanvas";
import { loadCommandJob, fetchHealth } from "./lib/api";
import type { AgentName, AgentStatus, JobArtifact } from "./lib/types";
import { AGENT_ACCENTS } from "./lib/types";

const AGENTS: AgentName[] = [
  "ContextSentinel",
  "CascadeAnalyzer",
  "CircuitBreaker",
  "FixArchitect",
  "MBOMEngine",
];

function agentStatuses(job: JobArtifact): Record<AgentName, AgentStatus> {
  const done = job.status === "succeeded";
  const base = Object.fromEntries(
    AGENTS.map((a) => [a, done ? "DONE" : "IDLE"]),
  ) as Record<AgentName, AgentStatus>;
  return base;
}

export default function App() {
  const [job, setJob] = useState<JobArtifact | null>(null);
  const [source, setSource] = useState<"api" | "demo">("demo");
  const [health, setHealth] = useState<string>("checking…");
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null);
  const [tab, setTab] = useState<"findings" | "gate" | "fix" | "mbom" | "raw">(
    "findings",
  );

  useEffect(() => {
    void (async () => {
      const h = await fetchHealth();
      setHealth(
        h?.status === "ok"
          ? `API · ${h.datahub ?? "up"} · ${h.mode ?? "live"}`
          : "Offline demo mode",
      );
      const loaded = await loadCommandJob();
      setJob(loaded.job);
      setSource(loaded.source);
      const firstImpacted =
        loaded.job.blast_radius.nodes.find((n) => n.impacted)?.urn ??
        loaded.job.root_urn;
      setSelectedUrn(firstImpacted);
    })();
  }, []);

  const statuses = useMemo(
    () => (job ? agentStatuses(job) : null),
    [job],
  );

  if (!job || !statuses) {
    return (
      <div className="flex h-full items-center justify-center bg-app text-muted">
        Loading MidSphere Command Center…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-app text-primary">
      <TopBar
        connection={health}
        source={source}
        risk={job.blast_radius.risk_score}
        onScan={() => {
          /* live scan wires to POST /v1/jobs later */
          setSource("demo");
          setJob({ ...job, job_id: `${job.job_id}-rerun` });
        }}
      />
      <div className="flex min-h-0 flex-1">
        <SwarmSidebar
          agents={AGENTS.map((name) => ({
            name,
            status: statuses[name],
            accent: AGENT_ACCENTS[name],
          }))}
          events={job.events}
          jobId={job.job_id}
        />
        <main className="relative min-w-0 flex-1">
          <LineageCanvas
            nodes={job.blast_radius.nodes}
            selectedUrn={selectedUrn}
            onSelect={setSelectedUrn}
          />
        </main>
        <InspectorDrawer
          job={job}
          selectedUrn={selectedUrn}
          tab={tab}
          onTab={setTab}
        />
      </div>
    </div>
  );
}
