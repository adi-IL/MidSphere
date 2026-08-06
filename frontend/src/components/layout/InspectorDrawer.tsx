import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { JobArtifact } from "../../lib/types";
import { resolveFixDiff, resolveMbomMarkdown } from "../../lib/demoJob";
import { RiskScorecard } from "../score/RiskScorecard";
import { RiskRadarChart } from "../score/RiskRadarChart";
import { GatePreview } from "../inspect/GatePreview";
import { DataHubAspectsViewer } from "../inspect/DataHubAspectsViewer";
import { RagChat } from "../inspect/RagChat";
import { ChevronDown } from "lucide-react";

type Tab = "findings" | "gate" | "aspects" | "fix" | "mbom" | "rag" | "raw";

interface Props {
  job: JobArtifact;
  selectedUrn: string | null;
  tab: Tab;
  onTab: (t: Tab) => void;
  onTripCircuit?: () => void;
  onLiftQuarantine?: () => void;
}

const PRIMARY_TABS: { id: Tab; label: string }[] = [
  { id: "findings", label: "Findings" },
  { id: "gate", label: "Gate" },
  { id: "mbom", label: "Attestation" },
];

const MORE_TABS: { id: Tab; label: string }[] = [
  { id: "fix", label: "Fix" },
  { id: "aspects", label: "Aspects" },
  { id: "rag", label: "Audit" },
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
  const [moreOpen, setMoreOpen] = useState(false);
  const node = job.blast_radius.nodes.find((n) => n.urn === selectedUrn);
  const gate = job.quarantine?.gateStatus ?? "OPEN";
  const nodeBlocked =
    Boolean(node?.impacted) &&
    gate === "BLOCKED" &&
    Boolean(job.quarantine?.entityUrns.includes(node?.urn ?? ""));

  const isMoreTab = MORE_TABS.some((t) => t.id === tab);

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-line bg-panel">
      <div className="shrink-0 border-b border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs font-medium text-mute">Decision</span>
          {node && (
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] ${
                node.impacted
                  ? "border-bad/30 text-bad"
                  : "border-line2 text-mute"
              }`}
            >
              {node.impacted ? "Impacted" : "Open"}
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-sm font-medium tracking-tight text-ink">
          {node?.name ?? "Select a node"}
        </div>
        {selectedUrn && (
          <div
            className="mt-1 truncate font-mono text-2xs text-faint"
            title={selectedUrn}
          >
            {selectedUrn}
          </div>
        )}
        {node?.reason && (
          <p className="mt-1.5 text-2xs leading-relaxed text-faint">
            {node.reason}
          </p>
        )}
        <div className="mt-3">
          <RiskScorecard
            score={job.blast_radius.risk_score}
            impacted={job.blast_radius.nodes.filter((n) => n.impacted).length}
            total={job.blast_radius.nodes.length}
          />
        </div>
      </div>

      {/* Primary tabs + More */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-line px-2 py-1.5">
        {PRIMARY_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onTab(t.id);
              setMoreOpen(false);
            }}
            className={`rounded px-2 py-1 text-2xs whitespace-nowrap transition-colors ${
              tab === t.id
                ? "bg-elevated text-ink"
                : "text-mute hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`inline-flex items-center gap-0.5 rounded px-2 py-1 text-2xs ${
              isMoreTab ? "bg-elevated text-ink" : "text-mute hover:text-ink"
            }`}
          >
            More
            <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 min-w-[7rem] rounded border border-line bg-elevated py-1 shadow-sm">
              {MORE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onTab(t.id);
                    setMoreOpen(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-2xs ${
                    tab === t.id
                      ? "text-ink"
                      : "text-mute hover:bg-panel hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 scrollbar-thin">
        {tab === "findings" && (
          <div className="space-y-2">
            {job.findings.length === 0 ? (
              <p className="text-2xs text-faint">No findings for this job.</p>
            ) : (
              job.findings.map((f) => (
                <div
                  key={f.id}
                  className="rounded border border-line bg-canvas p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink">{f.type}</span>
                    <span className="text-2xs text-mute">{f.severity}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-mute">
                    {f.rationale}
                  </p>
                  <p className="mt-2 font-mono text-2xs text-faint">
                    {f.evidence}
                  </p>
                </div>
              ))
            )}
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
              probeUrn={selectedUrn}
            />
            {!nodeBlocked && node && (
              <p className="text-2xs leading-relaxed text-faint">
                {node.impacted
                  ? "On the blast path, but not in the selective quarantine set."
                  : "Selective halt: this fork is outside the quarantine set."}
              </p>
            )}
            {job.blast_radius.live_enrichment && (
              <div className="rounded border border-line bg-canvas p-3">
                <div className="text-2xs font-medium text-faint">
                  Catalog enrichment
                </div>
                <p className="mt-1 text-2xs leading-relaxed text-mute">
                  {job.blast_radius.live_enrichment.note ||
                    "Scenario pack drives selective halt."}
                </p>
                <dl className="mt-2 space-y-1 font-mono text-2xs text-faint">
                  <div className="flex justify-between gap-2">
                    <dt>live_mcp_reads</dt>
                    <dd className="text-mute">
                      {job.blast_radius.live_enrichment.live_mcp_reads ?? 0}
                    </dd>
                  </div>
                  {(job.blast_radius.live_enrichment.lineage_urn_mentions ??
                    0) > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt>lineage_urn_mentions</dt>
                      <dd className="text-mute">
                        {
                          job.blast_radius.live_enrichment
                            .lineage_urn_mentions
                        }
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}

        {tab === "aspects" && (
          <DataHubAspectsViewer aspects={job.aspects} />
        )}

        {tab === "fix" && (
          <div className="space-y-2">
            <div className="rounded border border-line bg-canvas px-3 py-2">
              <div className="text-2xs font-medium text-mute">
                Remediation
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-mute">
                Suggested fix for the findings (dry-run when no GitHub token).
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
                </dl>
              )}
            </div>
            <pre className="overflow-x-auto rounded border border-line bg-canvas p-3 font-mono text-2xs leading-relaxed text-mute">
              {resolveFixDiff(job)}
            </pre>
          </div>
        )}

        {tab === "mbom" && (
          <div className="space-y-3">
            <div className="rounded border border-line bg-canvas px-3 py-2">
              <div className="text-2xs font-medium text-mute">
                Audit attestation
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-mute">
                Record of findings, risk, quarantine, and fix for this job.
                Live path uses{" "}
                <span className="font-mono text-ink">save_document</span> when
                mutations are enabled.
              </p>
              {job.mbom?.document_urn && (
                <p className="mt-2 font-mono text-2xs text-faint">
                  {job.mbom.document_urn}
                </p>
              )}
            </div>
            {/* Radar only under attestation, secondary */}
            <details className="group rounded border border-line bg-canvas">
              <summary className="cursor-pointer px-3 py-2 text-2xs text-mute hover:text-ink">
                Risk radar
              </summary>
              <div className="border-t border-line p-2">
                <RiskRadarChart riskScore={job.blast_radius.risk_score} />
              </div>
            </details>
            <article className="prose-ms">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {resolveMbomMarkdown(job)}
              </ReactMarkdown>
            </article>
          </div>
        )}

        {tab === "rag" && <RagChat job={job} />}

        {tab === "raw" && (
          <pre className="overflow-x-auto rounded border border-line bg-canvas p-3 font-mono text-2xs text-mute">
            {JSON.stringify(job, null, 2)}
          </pre>
        )}
      </div>

      {/* Sticky actions */}
      <div className="flex shrink-0 gap-2 border-t border-line p-3">
        <button
          type="button"
          onClick={onTripCircuit}
          disabled={Boolean(job.quarantine?.gateStatus === "BLOCKED")}
          title={
            job.quarantine?.gateStatus === "BLOCKED"
              ? "Circuit already tripped for this job"
              : "Trip advisory circuit breaker"
          }
          className="flex-1 rounded border border-line2 bg-elevated py-2 text-2xs font-medium text-ink transition-colors hover:enabled:border-bad/50 hover:enabled:text-bad disabled:cursor-not-allowed disabled:opacity-40"
        >
          Trip
        </button>
        <button
          type="button"
          onClick={onLiftQuarantine}
          disabled={!job.quarantine || gate === "LIFTED"}
          title={
            !job.quarantine || gate === "LIFTED"
              ? "No active quarantine to lift"
              : "Lift advisory quarantine"
          }
          className="flex-1 rounded border border-line py-2 text-2xs font-medium text-mute transition-colors hover:enabled:border-good/50 hover:enabled:text-good disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lift
        </button>
      </div>
    </aside>
  );
}
