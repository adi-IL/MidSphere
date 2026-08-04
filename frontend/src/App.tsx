import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "./components/layout/TopBar";
import {
  SwarmSidebar,
  type InspectorTab,
} from "./components/layout/SwarmSidebar";
import { InspectorDrawer } from "./components/layout/InspectorDrawer";
import { LoadingScreen } from "./components/layout/LoadingScreen";
import { LineageCanvas } from "./components/graph/LineageCanvas";
import { loadCommandJob, fetchHealth, createJob } from "./lib/api";
import type { AgentName, AgentStatus, JobArtifact, JobEvent } from "./lib/types";
import { AGENT_ACCENTS, DEFAULT_ROOT_URN } from "./lib/types";

const AGENTS: AgentName[] = [
  "ContextSentinel",
  "CascadeAnalyzer",
  "CircuitBreaker",
  "FixArchitect",
  "MBOMEngine",
];

const WAIT_HEARTBEATS: { agent: AgentName; message: string }[] = [
  {
    agent: "ContextSentinel",
    message: "stage=ContextSentinel closed loop started · probing catalog context",
  },
  {
    agent: "ContextSentinel",
    message: "awaiting workforce response · audit in flight…",
  },
  {
    agent: "CascadeAnalyzer",
    message: "awaiting blast-radius / risk stage…",
  },
  {
    agent: "CircuitBreaker",
    message: "awaiting selective quarantine stage…",
  },
  {
    agent: "FixArchitect",
    message: "awaiting fix artifact stage…",
  },
  {
    agent: "MBOMEngine",
    message: "awaiting MBOM attestation stage…",
  },
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

function nowTs(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function makeLog(
  agent: string,
  kind: JobEvent["kind"],
  message: string,
): JobEvent {
  return { ts: nowTs(), agent, kind, message };
}

function modeLabel(mode?: string): string {
  if (mode === "live_mcp") return "live";
  if (mode === "demo_closed_loop") return "demo";
  if (mode === "antigravity_closed_loop") return "closed loop";
  return "job";
}

/** Group job events by first appearance of each swarm agent (pipeline order). */
function eventsByAgent(events: JobEvent[]): Map<AgentName, JobEvent[]> {
  const map = new Map<AgentName, JobEvent[]>();
  for (const a of AGENTS) map.set(a, []);
  for (const e of events) {
    if (AGENTS.includes(e.agent as AgentName)) {
      map.get(e.agent as AgentName)!.push(e);
    }
  }
  // Orphan STATUS without agent mapping — attach to first agent if any
  const orphans = events.filter((e) => !AGENTS.includes(e.agent as AgentName));
  if (orphans.length) {
    const first = map.get("ContextSentinel")!;
    first.push(...orphans);
  }
  return map;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default function App() {
  const [job, setJob] = useState<JobArtifact | null>(null);
  const [source, setSource] = useState<"api" | "demo">("demo");
  const [health, setHealth] = useState<string>("checking…");
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>("findings");
  const [scanning, setScanning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentName | "ALL">("ALL");
  /** Sentinel-style newest-first live log */
  const [logs, setLogs] = useState<JobEvent[]>([]);
  const [statuses, setStatuses] = useState<Record<AgentName, AgentStatus>>(
    idleStatuses(),
  );
  const [bootStatus, setBootStatus] = useState("Connecting…");
  const cancelRef = useRef(false);
  const waitTimer = useRef<number | null>(null);

  const addLog = useCallback((log: JobEvent) => {
    // Prepend — same as Sentinel
    setLogs((prev) => [log, ...prev]);
  }, []);

  const clearWaitTimer = useCallback(() => {
    if (waitTimer.current != null) {
      window.clearInterval(waitTimer.current);
      waitTimer.current = null;
    }
  }, []);

  const seedLogsFromJob = useCallback((j: JobArtifact) => {
    // Initial load: show full job events newest-first (no freeze animation)
    const reversed = [...j.events].reverse();
    setLogs(reversed);
    setStatuses(j.status === "succeeded" ? doneStatuses() : idleStatuses());
  }, []);

  const applyJobArtifact = useCallback((j: JobArtifact, src: "api" | "demo") => {
    setJob(j);
    setSource(src);
    const firstImpacted =
      j.blast_radius.nodes.find((n) => n.impacted)?.urn ?? j.root_urn;
    setSelectedUrn(firstImpacted);
  }, []);

  useEffect(() => {
    void (async () => {
      setBootStatus("Checking API…");
      const h = await fetchHealth();
      setHealth(
        h?.status === "ok"
          ? `API · closed loop${h.datahub_reachable === false ? " · GMS offline" : ""}`
          : "Offline demo mode",
      );
      setBootStatus(
        h?.status === "ok" ? "Loading latest job…" : "Loading offline demo…",
      );
      const loaded = await loadCommandJob();
      applyJobArtifact(loaded.job, loaded.source);
      seedLogsFromJob(loaded.job);
    })();
    return () => {
      cancelRef.current = true;
      clearWaitTimer();
    };
  }, [applyJobArtifact, seedLogsFromJob, clearWaitTimer]);

  /**
   * Stream completed job events stage-by-stage into the terminal (Sentinel
   * sequential addLog after each agent step). Backend is still one POST;
   * presentation matches live terminal progression.
   */
  const streamJobIntoTerminal = useCallback(
    async (j: JobArtifact) => {
      const byAgent = eventsByAgent(j.events);
      const st = idleStatuses();
      setStatuses({ ...st });

      for (const agent of AGENTS) {
        if (cancelRef.current) return;
        st[agent] = "RUNNING";
        setStatuses({ ...st });
        addLog(
          makeLog(agent, "STATUS", `stage=${agent} running`),
        );

        const chunk = byAgent.get(agent) ?? [];
        if (chunk.length === 0) {
          await sleep(120);
        } else {
          // Reveal that stage's events one-by-one (newest-first prepend)
          for (const ev of chunk) {
            if (cancelRef.current) return;
            addLog(ev);
            await sleep(90);
          }
        }

        st[agent] = "DONE";
        setStatuses({ ...st });
        addLog(makeLog(agent, "STATUS", `stage=${agent} done`));

        // Friendly CTA after MBOM / Fix stages so operators know where to review
        if (agent === "MBOMEngine" && j.mbom) {
          addLog(
            makeLog(
              "MBOMEngine",
              "MBOM",
              `mbom artifact path=${j.mbom.path ?? "examples/mboms/healthcare-billing-mbom.example.md"} urn=${j.mbom.document_urn ?? ""}`,
            ),
          );
          addLog(
            makeLog(
              "MBOMEngine",
              "STATUS",
              "MBOM ready — open Inspector → MBOM to review the attestation",
            ),
          );
        }
        if (agent === "FixArchitect" && j.pr) {
          addLog(
            makeLog(
              "FixArchitect",
              "PR",
              `dry_run path=${j.pr.path ?? "examples/prs/fix-negative-billing.example.diff"}`,
            ),
          );
        }
        await sleep(60);
      }

      addLog(
        makeLog(
          "ContextSentinel",
          "STATUS",
          `job complete risk=${j.blast_radius.risk_score} findings=${j.findings.length}`,
        ),
      );
      setStatuses(doneStatuses());
    },
    [addLog],
  );

  const onScan = useCallback(async () => {
    cancelRef.current = false;
    clearWaitTimer();
    setScanning(true);
    setSelectedAgent("ALL");
    setLogs([]);
    setStatuses(() => {
      const s = idleStatuses();
      s.ContextSentinel = "RUNNING";
      return s;
    });

    // Keep graph visible but clear quarantine state during run
    setJob((prev) =>
      prev
        ? {
            ...prev,
            status: "running",
            findings: [],
            quarantine: null,
            events: [],
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

    addLog(
      makeLog(
        "ContextSentinel",
        "STATUS",
        "POST /v1/jobs · closed loop submitted",
      ),
    );
    addLog(
      makeLog(
        "ContextSentinel",
        "STATUS",
        WAIT_HEARTBEATS[0].message,
      ),
    );

    // Live heartbeats while waiting on blocking API (prevents empty freeze)
    let beat = 1;
    waitTimer.current = window.setInterval(() => {
      const step = WAIT_HEARTBEATS[Math.min(beat, WAIT_HEARTBEATS.length - 1)];
      addLog(makeLog(step.agent, "STATUS", step.message));
      setStatuses((prev) => {
        const next = { ...prev };
        // Soft-progress stages while waiting
        const idx = Math.min(beat, AGENTS.length - 1);
        for (let i = 0; i < AGENTS.length; i++) {
          if (i < idx) next[AGENTS[i]] = "DONE";
          else if (i === idx) next[AGENTS[i]] = "RUNNING";
          else next[AGENTS[i]] = "IDLE";
        }
        return next;
      });
      beat += 1;
    }, 2800);

    try {
      const created = await createJob({
        root_urn: job?.root_urn ?? DEFAULT_ROOT_URN,
        mode: "full",
        auto_trip: true,
      });
      clearWaitTimer();

      if (created?.job_id) {
        addLog(
          makeLog(
            "ContextSentinel",
            "STATUS",
            `response received job=${created.job_id.slice(0, 8)}… streaming stages`,
          ),
        );
        applyJobArtifact(created, "api");
        setHealth((prev) =>
          prev.startsWith("Offline") ? "API · closed loop" : prev,
        );
        // Reset soft-progress; stream real events stage-by-stage
        setStatuses(idleStatuses());
        await streamJobIntoTerminal(created);
      } else if (job) {
        const demo: JobArtifact = {
          ...job,
          job_id: `${job.job_id}-rerun-${Date.now()}`,
          status: "succeeded",
        };
        addLog(
          makeLog(
            "ContextSentinel",
            "STATUS",
            "API unavailable · replaying local demo artifact",
          ),
        );
        applyJobArtifact(demo, "demo");
        setStatuses(idleStatuses());
        await streamJobIntoTerminal(demo);
      } else {
        addLog(
          makeLog("ContextSentinel", "ERROR", "scan failed · no job returned"),
        );
        setStatuses(idleStatuses());
      }
    } catch (e) {
      clearWaitTimer();
      const msg = e instanceof Error ? e.message : "unknown error";
      addLog(makeLog("ContextSentinel", "ERROR", `scan failed: ${msg}`));
      setStatuses(idleStatuses());
    } finally {
      clearWaitTimer();
      setScanning(false);
    }
  }, [
    addLog,
    applyJobArtifact,
    clearWaitTimer,
    job,
    streamJobIntoTerminal,
  ]);

  const onClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const agents = useMemo(
    () =>
      AGENTS.map((name) => ({
        name,
        status: statuses[name],
        accent: AGENT_ACCENTS[name],
        short: "",
      })),
    [statuses],
  );

  if (!job) {
    return <LoadingScreen status={bootStatus} />;
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
          agents={agents}
          logs={logs}
          jobId={job.job_id}
          modeLabel={modeLabel(job.execution_mode)}
          scanning={scanning}
          selectedAgent={selectedAgent}
          onSelectAgent={setSelectedAgent}
          onClearLogs={onClearLogs}
          onOpenTab={setTab}
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
