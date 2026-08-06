import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { JobArtifact } from "../../lib/types";
import { resolveFixDiff, resolveMbomMarkdown } from "../../lib/demoJob";
import { RiskScorecard } from "../score/RiskScorecard";
import { RiskRadarChart } from "../score/RiskRadarChart";
import { GatePreview } from "../inspect/GatePreview";
import { DataHubAspectsViewer } from "../inspect/DataHubAspectsViewer";
import { RagChat } from "../inspect/RagChat";

type Tab = "findings" | "gate" | "aspects" | "fix" | "mbom" | "rag" | "raw";

interface Props {
  job: JobArtifact;
  selectedUrn: string | null;
  tab: Tab;
  onTab: (t: Tab) => void;
  onTripCircuit?: () => void;
  onLiftQuarantine?: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "findings", label: "Findings" },
  { id: "gate", label: "Gate" },
  { id: "aspects", label: "Aspects" },
  { id: "fix", label: "Fix" },
  { id: "mbom", label: "MBOM" },
  { id: "rag", label: "Audit Q&A" },
  { id: "raw", label: "Raw" },
];

export function InspectorDrawer({
  job,
  selectedUrn,
  tab,
  onTab,
  onTripCircuit,
  onLiftQuarantine,
}: Props) {

  const node = job.blast_radius.nodes.find((n) => n.urn === selectedUrn);
  const gate = job.quarantine?.gateStatus ?? "OPEN";
  const nodeBlocked =
    Boolean(node?.impacted) &&
    gate === "BLOCKED" &&
    Boolean(job.quarantine?.entityUrns.includes(node?.urn ?? ""));

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-line bg-panel">
      <div className="shrink-0 border-b border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-faint">
            Inspector
          </div>
          {node && (
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                node.impacted
                  ? "border-bad/30 text-bad"
                  : "border-good/30 text-good"
              }`}
            >
              {node.impacted ? "impacted" : "open"}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm font-medium tracking-tight text-ink">
          {node?.name ?? "Select a node"}
        </div>
        <div className="mt-1 truncate font-mono text-2xs text-mute" title={selectedUrn ?? undefined}>
          {selectedUrn}
        </div>
        {node?.reason && (
          <p className="mt-1.5 text-2xs leading-relaxed text-faint">{node.reason}</p>
        )}
        <div className="mt-3 grid grid-cols-1 gap-2">
          <RiskScorecard
            score={job.blast_radius.risk_score}
            impacted={job.blast_radius.nodes.filter((n) => n.impacted).length}
            total={job.blast_radius.nodes.length}
          />
        </div>
      </div>

      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5 custom-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wide whitespace-nowrap ${
              tab === t.id
                ? "bg-elevated text-ink border border-line"
                : "text-mute hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-thin flex flex-col">
        {tab === "findings" && (

          <div className="space-y-3">
            <RiskRadarChart riskScore={job.blast_radius.risk_score} />
            <div className="space-y-2">
              {job.findings.map((f) => (
                <div
                  key={f.id}
                  className="rounded-md border border-line bg-canvas p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink">{f.type}</span>
                    <span className="text-2xs text-mute">{f.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-mute">{f.rationale}</p>
                  <p className="mt-2 font-mono text-2xs text-faint">{f.evidence}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "gate" && (
          <div className="space-y-3">
            <GatePreview
              status={
                nodeBlocked
                  ? "BLOCKED"
                  : gate === "LIFTED" && node?.impacted
                    ? "LIFTED"
                    : "OPEN"
              }
              tags={nodeBlocked ? (job.quarantine?.tagsApplied ?? []) : []}
              properties={
                nodeBlocked ? (job.quarantine?.properties ?? {}) : {}
              }
            />
            {!nodeBlocked && node && (
              <p className="text-2xs leading-relaxed text-faint">
                {node.impacted
                  ? "On the blast path, but not in the selective quarantine set (only gated entities are BLOCKED)."
                  : "Selective halt: this fork is outside the quarantine set for the current findings."}
              </p>
            )}
          </div>
        )}

        {tab === "aspects" && (
          <DataHubAspectsViewer aspects={job.aspects} />
        )}

        {tab === "fix" && (
          <div className="space-y-2">
            <div className="rounded-md border border-line bg-canvas px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-faint">
                Remediation artifact
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-mute">
                Suggested SQL/dbt fix for the findings (dry-run when no GitHub
                token). Review the diff below.
              </p>
              {job.pr && (
                <dl className="mt-2 space-y-1 font-mono text-2xs text-mute">
                  <div className="flex justify-between gap-2">
                    <dt className="text-faint">status</dt>
                    <dd className="text-ink">{job.pr.status}</dd>
                  </div>
                  {job.pr.path && (
                    <div>
                      <dt className="text-faint">path</dt>
                      <dd className="mt-0.5 break-all text-ink">{job.pr.path}</dd>
                    </div>
                  )}
                  {job.pr.diff_summary && (
                    <div>
                      <dt className="text-faint">summary</dt>
                      <dd className="mt-0.5 text-ink">{job.pr.diff_summary}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
            <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-2xs leading-relaxed text-mute">
              {resolveFixDiff(job)}
            </pre>
          </div>
        )}

        {tab === "mbom" && (
          <div className="space-y-3">
            <div className="rounded-md border border-line bg-canvas px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-faint">
                Audit attestation (MBOM)
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-mute">
                Durable record of findings, risk, quarantine, and fix so the next
                operator inherits this job. When DataHub mutations are live this
                is published via{" "}
                <span className="font-mono text-ink">save_document</span>; offline
                demo shows the shipped example below.
              </p>
              {job.mbom?.document_urn && (
                <p className="mt-2 font-mono text-2xs text-faint">
                  doc · {job.mbom.document_urn}
                </p>
              )}
              {job.mbom?.path && (
                <p className="mt-0.5 font-mono text-2xs text-faint">
                  path · {job.mbom.path}
                </p>
              )}
            </div>
            <article className="prose-ms">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {resolveMbomMarkdown(job)}
              </ReactMarkdown>
            </article>
          </div>
        )}

        {tab === "rag" && <RagChat job={job} />}

        {tab === "raw" && (
          <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-2xs text-mute">
            {JSON.stringify(job, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-line p-3">
        <button
          type="button"
          onClick={onTripCircuit}
          disabled={Boolean(job.quarantine?.gateStatus === "BLOCKED")}
          title={
            job.quarantine?.gateStatus === "BLOCKED"
              ? "Circuit already tripped for this job (gated entities BLOCKED)"
              : "Trip advisory circuit breaker and block gated entities"
          }
          className="flex-1 rounded-md border border-line2 bg-elevated py-2 text-2xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:border-bad/60 hover:enabled:text-bad transition-colors shadow-sm"
        >
          Trip circuit
        </button>
        <button
          type="button"
          onClick={onLiftQuarantine}
          disabled={!job.quarantine || gate === "LIFTED"}
          title={
            !job.quarantine || gate === "LIFTED"
              ? "No active BLOCKED quarantine to lift"
              : "Lift clears advisory quarantine and unblocks gated entities"
          }
          className="flex-1 rounded-md border border-line py-2 text-2xs font-semibold text-mute disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:border-good/60 hover:enabled:text-good transition-colors shadow-sm"
        >
          Lift quarantine
        </button>
      </div>
    </aside>
  );
}


