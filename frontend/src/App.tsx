import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "./components/layout/TopBar";
import {
  SwarmSidebar,
  type InspectorTab,
} from "./components/layout/SwarmSidebar";
import { InspectorDrawer } from "./components/layout/InspectorDrawer";
import { LoadingScreen } from "./components/layout/LoadingScreen";
import { LineageCanvas } from "./components/graph/LineageCanvas";
import { loadCommandJob, fetchHealth, createJob, liftQuarantineJob, tripJob } from "./lib/api";


import type { AgentName, AgentStatus, JobArtifact, JobEvent, ScenarioId } from "./lib/types";
import { AGENT_ACCENTS, DEFAULT_ROOT_URN, SCENARIOS } from "./lib/types";
import { DEMO_JOB, ECOMMERCE_JOB, NYCTAXI_JOB } from "./lib/demoJob";
import {
  runKindFromMode,
  type CatalogState,
  type ConnectionState,
} from "./lib/status";

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
    message: "awaiting workforce response · audit in flight...",
  },
  {
    agent: "CascadeAnalyzer",
    message: "awaiting blast-radius / risk stage...",
  },
  {
    agent: "CircuitBreaker",
    message: "awaiting selective quarantine stage...",
  },
  {
    agent: "FixArchitect",
    message: "awaiting fix artifact stage...",
  },
  {
    agent: "MBOMEngine",
    message: "awaiting MBOM attestation stage...",
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
  latency_ms?: number,
  items_processed?: number,
): JobEvent {
  return { ts: nowTs(), agent, kind, message, latency_ms, items_processed };
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
  // Orphan STATUS without agent mapping  -  attach to first agent if any
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
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [catalog, setCatalog] = useState<CatalogState>("unknown");
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>("findings");
  const [scanning, setScanning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentName | "ALL">("ALL");
  const [activeScenario, setActiveScenario] = useState<ScenarioId>("healthcare");
  /** Sentinel-style newest-first live log */
  const [logs, setLogs] = useState<JobEvent[]>([]);
  const [statuses, setStatuses] = useState<Record<AgentName, AgentStatus>>(
    idleStatuses(),
  );
  const [bootStatus, setBootStatus] = useState("Connecting...");
  /** Shown once when API is up but /jobs/latest is empty (404 → sample fallback). */
  const [bootHint, setBootHint] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const waitTimer = useRef<number | null>(null);

  const addLog = useCallback((log: JobEvent) => {
    // Prepend  -  same as Sentinel
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
    if (src === "api") setBootHint(null);
    const firstImpacted =
      j.blast_radius.nodes.find((n) => n.impacted)?.urn ?? j.root_urn;
    setSelectedUrn(firstImpacted);
  }, []);

  useEffect(() => {
    void (async () => {
      setBootStatus("Checking API...");
      const h = await fetchHealth();
      if (h?.status === "ok") {
        setConnection("live");
        setCatalog(
          h.datahub_reachable === true
            ? "on"
            : h.datahub_reachable === false
              ? "off"
              : "unknown",
        );
        setBootStatus("Loading latest job...");
      } else {
        setConnection("offline");
        setCatalog("unknown");
        setBootStatus("Loading sample data...");
      }
      const loaded = await loadCommandJob();
      applyJobArtifact(loaded.job, loaded.source);
      seedLogsFromJob(loaded.job);
      if (h?.status === "ok" && loaded.source === "demo") {
        setBootHint(
          "API reachable · no prior job on this instance — showing sample until you Run",
        );
      } else {
        setBootHint(null);
      }
    })();
    return () => {
      cancelRef.current = true;
      clearWaitTimer();
    };
  }, [applyJobArtifact, seedLogsFromJob, clearWaitTimer]);

  // Periodically check health when GMS is offline to detect boot completion automatically
  useEffect(() => {
    if (connection !== "live" || catalog === "on") return;
    const interval = setInterval(async () => {
      const h = await fetchHealth();
      if (h?.status === "ok") {
        setCatalog(
          h.datahub_reachable === true
            ? "on"
            : h.datahub_reachable === false
              ? "off"
              : "unknown",
        );
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [connection, catalog]);


  const onSelectScenario = useCallback((id: ScenarioId) => {
    setBootHint(null);
    setActiveScenario(id);
    let targetJob = DEMO_JOB;
    if (id === "ecommerce") targetJob = ECOMMERCE_JOB;
    if (id === "nyctaxi") targetJob = NYCTAXI_JOB;

    applyJobArtifact(targetJob, "demo");
    seedLogsFromJob(targetJob);
  }, [applyJobArtifact, seedLogsFromJob]);

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
        addLog(makeLog(agent, "STATUS", `stage=${agent} done`, 180, 4));

        // Friendly CTA after MBOM / Fix stages so operators know where to review
        if (agent === "MBOMEngine" && j.mbom) {
          addLog(
            makeLog(
              "MBOMEngine",
              "MBOM",
              `mbom artifact path=${j.mbom.path ?? "examples/mboms/healthcare-billing-mbom.example.md"} urn=${j.mbom.document_urn ?? ""}`,
              120,
              1,
            ),
          );
          addLog(
            makeLog(
              "MBOMEngine",
              "STATUS",
              "MBOM ready  -  open Inspector → MBOM to review the attestation",
            ),
          );
        }
        if (agent === "FixArchitect" && j.pr) {
          addLog(
            makeLog(
              "FixArchitect",
              "PR",
              `dry_run path=${j.pr.path ?? "examples/prs/fix-negative-billing.example.diff"}`,
              150,
              1,
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
      setJob(j);
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

    const scenarioSpec = SCENARIOS.find((s) => s.id === activeScenario);
    const targetUrn = scenarioSpec?.rootUrn || job?.root_urn || DEFAULT_ROOT_URN;

    addLog(
      makeLog(
        "ContextSentinel",
        "STATUS",
        `POST /v1/jobs · target=${activeScenario}`,
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
        root_urn: targetUrn,
        mode: "full",
        auto_trip: true,
      });
      clearWaitTimer();

      if (created?.job_id) {
        addLog(
          makeLog(
            "ContextSentinel",
            "STATUS",
            `response received job=${created.job_id.slice(0, 8)}... streaming stages`,
          ),
        );
        applyJobArtifact(created, "api");
        setConnection("live");
        // Reset soft-progress; stream real events stage-by-stage
        setStatuses(idleStatuses());
        await streamJobIntoTerminal(created);
      } else {
        let targetJob = DEMO_JOB;
        if (activeScenario === "ecommerce") targetJob = ECOMMERCE_JOB;
        if (activeScenario === "nyctaxi") targetJob = NYCTAXI_JOB;
        const demo: JobArtifact = {
          ...targetJob,
          job_id: `${targetJob.job_id}-rerun-${Date.now()}`,
          status: "succeeded",
        };
        addLog(
          makeLog(
            "ContextSentinel",
            "STATUS",
            `API unavailable · replaying ${activeScenario} sample job`,
          ),
        );
        applyJobArtifact(demo, "demo");
        setStatuses(idleStatuses());
        await streamJobIntoTerminal(demo);
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
    activeScenario,
    addLog,
    applyJobArtifact,
    clearWaitTimer,
    job,
    streamJobIntoTerminal,
  ]);

  // Keyboard shortcut listener for Cmd+Enter / Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!scanning) void onScan();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, scanning]);

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

  const onTripCircuit = useCallback(async () => {
    if (!job) return;
    const targetUrn = job.blast_radius.nodes.find((n) => n.impacted)?.urn ?? job.root_urn;
    if (source === "api") {
      const updated = await tripJob(job.job_id);
      if (updated) {
        setJob(updated);
        addLog(
          makeLog(
            "CircuitBreaker",
            "STATUS",
            `manual circuit trip submitted job=${job.job_id} gate_status=BLOCKED urn=${targetUrn}`,
          ),
        );
        return;
      }
      addLog(
        makeLog(
          "CircuitBreaker",
          "STATUS",
          "API trip failed or timed out · applying local sim gate BLOCKED",
        ),
      );
    }

    // Local / Offline demo trip
    setJob((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        quarantine: {
          entityUrns: [targetUrn],
          tagsApplied: ["urn:li:tag:QUARANTINED", "urn:li:tag:CIRCUIT_BROKEN", "urn:li:tag:MIDSPHERE_AUDIT"],
          properties: {
            "midsphere.gate_status": "BLOCKED",
            "midsphere.risk_score": String(prev.blast_radius.risk_score),
            "midsphere.job_id": prev.job_id,
          },
          incidentUrn: undefined,
          gateStatus: "BLOCKED",
        },
        blast_radius: {
          ...prev.blast_radius,
          // Selective halt: only mark the trip target (and prior hop chain already set by job)
          nodes: prev.blast_radius.nodes.map((n) =>
            n.urn === targetUrn ? { ...n, impacted: true } : n,
          ),
        },
      };
    });
    addLog(
      makeLog(
        "CircuitBreaker",
        "STATUS",
        `sim manual circuit trip tag=QUARANTINED gate_status=BLOCKED urn=${targetUrn}`,
      ),
    );
  }, [job, source, addLog]);

  const onLiftQuarantine = useCallback(async () => {
    if (!job) return;
    if (source === "api") {
      const updated = await liftQuarantineJob(job.job_id);
      if (updated) {
        setJob(updated);
        addLog(
          makeLog(
            "CircuitBreaker",
            "STATUS",
            `quarantine lift submitted for job=${job.job_id} gate_status=LIFTED`,
          ),
        );
        return;
      }
      addLog(
        makeLog(
          "CircuitBreaker",
          "STATUS",
          "API lift failed or timed out · applying local sim gate LIFTED",
        ),
      );
    }

    // Local / Offline demo lift
    setJob((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        quarantine: prev.quarantine
          ? {
              ...prev.quarantine,
              entityUrns: [],
              gateStatus: "LIFTED",
              tagsApplied: prev.quarantine.tagsApplied ?? [],
              properties: {
                ...prev.quarantine.properties,
                "midsphere.gate_status": "LIFTED",
              },
            }
          : null,
        blast_radius: {
          ...prev.blast_radius,
          nodes: prev.blast_radius.nodes.map((n) => ({
            ...n,
            impacted: false,
          })),
        },
      };
    });
    addLog(
      makeLog(
        "CircuitBreaker",
        "STATUS",
        `sim quarantine lifted for job=${job.job_id} gate_status=LIFTED`,
      ),
    );
  }, [job, source, addLog]);

  if (!job) {
    return <LoadingScreen status={bootStatus} />;
  }

  return (
    <div className="flex h-full flex-col bg-canvas text-ink">
      <TopBar
        connection={connection}
        dataSource={source}
        catalog={catalog}
        scanning={scanning}
        activeScenario={activeScenario}
        onSelectScenario={onSelectScenario}
        onScan={() => void onScan()}
      />
      {bootHint ? (
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel px-4 py-2 text-2xs text-mute"
          role="status"
        >
          <span>{bootHint}</span>
          <button
            type="button"
            onClick={() => setBootHint(null)}
            className="shrink-0 text-mute transition-colors hover:text-ink"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <SwarmSidebar
          agents={agents}
          logs={logs}
          jobId={job.job_id}
          runKind={runKindFromMode(job.execution_mode, source)}
          scanning={scanning}
          metrics={{
            risk: job.blast_radius.risk_score,
            findings: job.findings.length,
            impacted: job.blast_radius.nodes.filter((n) => n.impacted).length,
            total: job.blast_radius.nodes.length,
            gate: job.quarantine?.gateStatus ?? " - ",
          }}
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
            activeScenarioLabel={SCENARIOS.find((s) => s.id === activeScenario)?.name}
          />
        </main>
        <InspectorDrawer
          job={job}
          selectedUrn={selectedUrn}
          tab={tab}
          onTab={setTab}
          onTripCircuit={onTripCircuit}
          onLiftQuarantine={onLiftQuarantine}
        />
      </div>
    </div>
  );
}


