import { useCallback, useEffect, useMemo, useState } from "react";
import { TopBar } from "./components/layout/TopBar";
import { SwarmSidebar } from "./components/layout/SwarmSidebar";
import { InspectorDrawer } from "./components/layout/InspectorDrawer";
import { LineageCanvas } from "./components/graph/LineageCanvas";
import { loadCommandJob, fetchHealth, createJob } from "./lib/api";
import type { AgentName, AgentStatus, JobArtifact } from "./lib/types";
import { AGENT_ACCENTS, DEFAULT_ROOT_URN } from "./lib/types";

const AGENTS: AgentName[] = [
  "ContextSentinel",
  "CascadeAnalyzer",
  "CircuitBreaker",
  "FixArchitect",
  "MBOMEngine",
];

function agentStatuses(job: JobArtifact): Record<AgentName, AgentStatus> {
  const done = job.status === "succeeded";
  return Object.fromEntries(
    AGENTS.map((a) => [a, done ? "DONE" : "IDLE"]),
  ) as Record<AgentName, AgentStatus>;
}

export default function App() {
  const [job, setJob] = useState<JobArtifact | null>(null);
  const [source, setSource] = useState<"api" | "demo">("demo");
  const [health, setHealth] = useState<string>("checking…");
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null);
  const [tab, setTab] = useState<"findings" | "gate" | "fix" | "mbom" | "raw">(
    "findings",
  );
  const [scanning, setScanning] = useState(false);

  const applyJob = useCallback((j: JobArtifact, src: "api" | "demo") => {
    setJob(j);
    setSource(src);
    const firstImpacted =
      j.blast_radius.nodes.find((n) => n.impacted)?.urn ?? j.root_urn;
    setSelectedUrn(firstImpacted);
  }, []);

  useEffect(() => {
    void (async () => {
      const h = await fetchHealth();
      setHealth(
        h?.status === "ok"
          ? `API · ${h.mode ?? "live"}${h.datahub_reachable === false ? " · GMS offline" : ""}`
          : "Offline demo mode",
      );
      const loaded = await loadCommandJob();
      applyJob(loaded.job, loaded.source);
    })();
  }, [applyJob]);

  const onScan = useCallback(async () => {
    setScanning(true);
    try {
      const created = await createJob({
        root_urn: job?.root_urn ?? DEFAULT_ROOT_URN,
        mode: "full",
        auto_trip: true,
      });
      if (created?.job_id) {
        applyJob(created, "api");
        setHealth((prev) =>
          prev.startsWith("Offline") ? "API · closed_loop" : prev,
        );
      } else if (job) {
        // offline fallback: re-seed demo with new id
        applyJob(
          { ...job, job_id: `${job.job_id}-rerun-${Date.now()}` },
          "demo",
        );
      }
    } finally {
      setScanning(false);
    }
  }, [applyJob, job]);

  const statuses = useMemo(
    () => (job ? agentStatuses(job) : null),
    [job],
  );

  if (!job || !statuses) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas text-mute">
        Loading MidSphere…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-canvas text-ink">
      <TopBar
        connection={scanning ? "Scanning…" : health}
        source={source}
        risk={job.blast_radius.risk_score}
        onScan={() => void onScan()}
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
