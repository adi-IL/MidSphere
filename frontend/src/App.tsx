import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function idleStatuses(): Record<AgentName, AgentStatus> {
  return Object.fromEntries(AGENTS.map((a) => [a, "IDLE"])) as Record<
    AgentName,
    AgentStatus
  >;
}

function doneStatuses(): Record<AgentName, AgentStatus> {
  return Object.fromEntries(AGENTS.map((a) => [a, "DONE"])) as Record<
    AgentName,
    AgentStatus
  >;
}

/** Derive stage status from which agents appear in the visible event prefix. */
function statusesFromEvents(
  job: JobArtifact,
  visibleCount: number,
  scanning: boolean,
): Record<AgentName, AgentStatus> {
  const slice = job.events.slice(0, visibleCount);
  const seen = new Set<string>();
  for (const e of slice) {
    if (AGENTS.includes(e.agent as AgentName)) seen.add(e.agent);
  }

  const out = idleStatuses();
  if (scanning && slice.length === 0) {
    out.ContextSentinel = "RUNNING";
    return out;
  }

  let last: AgentName | null = null;
  for (const a of AGENTS) {
    if (seen.has(a)) {
      out[a] = "DONE";
      last = a;
    }
  }

  // While replaying, mark the next incomplete stage as running
  if (visibleCount < job.events.length && last) {
    const idx = AGENTS.indexOf(last);
    if (idx >= 0 && idx < AGENTS.length - 1) {
      const next = AGENTS[idx + 1];
      if (out[next] === "IDLE") out[next] = "RUNNING";
    }
  } else if (visibleCount < job.events.length && !last) {
    out.ContextSentinel = "RUNNING";
  } else if (job.status === "succeeded" && visibleCount >= job.events.length) {
    return doneStatuses();
  }

  return out;
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
  const [selectedAgent, setSelectedAgent] = useState<AgentName | "ALL">("ALL");
  const [visibleEventCount, setVisibleEventCount] = useState(0);
  const [replayActive, setReplayActive] = useState(false);
  const replayTimer = useRef<number | null>(null);

  const clearReplay = useCallback(() => {
    if (replayTimer.current != null) {
      window.clearInterval(replayTimer.current);
      replayTimer.current = null;
    }
    setReplayActive(false);
  }, []);

  const startReplay = useCallback(
    (j: JobArtifact, animate: boolean) => {
      clearReplay();
      if (!animate || j.events.length === 0) {
        setVisibleEventCount(j.events.length);
        setReplayActive(false);
        return;
      }
      setVisibleEventCount(0);
      setReplayActive(true);
      let i = 0;
      const step = Math.max(1, Math.ceil(j.events.length / 40));
      replayTimer.current = window.setInterval(() => {
        i = Math.min(j.events.length, i + step);
        setVisibleEventCount(i);
        if (i >= j.events.length) {
          clearReplay();
          setVisibleEventCount(j.events.length);
        }
      }, 45);
    },
    [clearReplay],
  );

  const applyJob = useCallback(
    (j: JobArtifact, src: "api" | "demo", animate = false) => {
      setJob(j);
      setSource(src);
      const firstImpacted =
        j.blast_radius.nodes.find((n) => n.impacted)?.urn ?? j.root_urn;
      setSelectedUrn(firstImpacted);
      startReplay(j, animate);
    },
    [startReplay],
  );

  useEffect(() => {
    void (async () => {
      const h = await fetchHealth();
      setHealth(
        h?.status === "ok"
          ? `API · closed loop${h.datahub_reachable === false ? " · GMS offline" : ""}`
          : "Offline demo mode",
      );
      const loaded = await loadCommandJob();
      // Initial load: show full stream (no theatrical replay)
      applyJob(loaded.job, loaded.source, false);
    })();
    return () => clearReplay();
  }, [applyJob, clearReplay]);

  const onScan = useCallback(async () => {
    setScanning(true);
    setSelectedAgent("ALL");
    setVisibleEventCount(0);
    setReplayActive(false);
    // Optimistic: show first stage running while request in flight
    setJob((prev) =>
      prev
        ? {
            ...prev,
            events: [],
            status: "running",
            findings: [],
            quarantine: null,
            blast_radius: {
              ...prev.blast_radius,
              risk_score: 0,
              nodes: prev.blast_radius.nodes.map((n) => ({
                ...n,
                impacted: false,
              })),
            },
          }
        : prev,
    );
    try {
      const created = await createJob({
        root_urn: job?.root_urn ?? DEFAULT_ROOT_URN,
        mode: "full",
        auto_trip: true,
      });
      if (created?.job_id) {
        applyJob(created, "api", true);
        setHealth((prev) =>
          prev.startsWith("Offline") ? "API · closed loop" : prev,
        );
      } else if (job) {
        applyJob(
          {
            ...job,
            job_id: `${job.job_id}-rerun-${Date.now()}`,
            status: "succeeded",
          },
          "demo",
          true,
        );
      }
    } finally {
      setScanning(false);
    }
  }, [applyJob, job]);

  const statuses = useMemo(() => {
    if (!job) return null;
    if (scanning && job.events.length === 0) {
      const s = idleStatuses();
      s.ContextSentinel = "RUNNING";
      return s;
    }
    return statusesFromEvents(job, visibleEventCount, scanning);
  }, [job, visibleEventCount, scanning]);

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
        scanning={scanning}
        onScan={() => void onScan()}
      />
      <div className="flex min-h-0 flex-1">
        <SwarmSidebar
          agents={AGENTS.map((name) => ({
            name,
            status: statuses[name],
            accent: AGENT_ACCENTS[name],
            short: "",
          }))}
          events={job.events}
          jobId={job.job_id}
          job={job}
          scanning={scanning}
          replayActive={replayActive}
          visibleEventCount={visibleEventCount}
          selectedAgent={selectedAgent}
          onSelectAgent={setSelectedAgent}
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
