import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { JobArtifact } from "../../lib/types";
import { DEMO_DIFF, DEMO_MBOM } from "../../lib/demoJob";
import { RiskScorecard } from "../score/RiskScorecard";
import { GatePreview } from "../inspect/GatePreview";

type Tab = "findings" | "gate" | "fix" | "mbom" | "raw";

interface Props {
  job: JobArtifact;
  selectedUrn: string | null;
  tab: Tab;
  onTab: (t: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "findings", label: "Findings" },
  { id: "gate", label: "Gate" },
  { id: "fix", label: "Fix" },
  { id: "mbom", label: "MBOM" },
  { id: "raw", label: "Raw" },
];

export function InspectorDrawer({ job, selectedUrn, tab, onTab }: Props) {
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
        <div className="mt-3">
          <RiskScorecard
            score={job.blast_radius.risk_score}
            impacted={job.blast_radius.nodes.filter((n) => n.impacted).length}
            total={job.blast_radius.nodes.length}
          />
        </div>
      </div>

      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wide ${
              tab === t.id
                ? "bg-elevated text-ink"
                : "text-mute hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {tab === "findings" && (
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

        {tab === "fix" && (
          <div className="space-y-2">
            {job.pr && (
              <div className="rounded-md border border-line bg-canvas px-3 py-2 font-mono text-2xs text-mute">
                <div className="text-faint">status</div>
                <div className="text-ink">{job.pr.status}</div>
                {job.pr.path && (
                  <>
                    <div className="mt-1 text-faint">path</div>
                    <div className="break-all text-ink">{job.pr.path}</div>
                  </>
                )}
                {job.pr.diff_summary && (
                  <>
                    <div className="mt-1 text-faint">summary</div>
                    <div className="text-ink">{job.pr.diff_summary}</div>
                  </>
                )}
              </div>
            )}
            <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-2xs leading-relaxed text-mute">
              {DEMO_DIFF}
            </pre>
          </div>
        )}

        {tab === "mbom" && (
          <article className="prose-ms">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {DEMO_MBOM}
            </ReactMarkdown>
            {job.mbom?.document_urn && (
              <p className="mt-3 font-mono text-2xs text-faint">
                {job.mbom.document_urn}
              </p>
            )}
            {job.mbom?.path && (
              <p className="mt-1 font-mono text-2xs text-faint">{job.mbom.path}</p>
            )}
          </article>
        )}

        {tab === "raw" && (
          <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-2xs text-mute">
            {JSON.stringify(job, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-line p-3">
        <button
          type="button"
          disabled={Boolean(job.quarantine)}
          title={
            job.quarantine
              ? "Circuit already tripped for this job"
              : "Trip requires a full scan with auto_trip"
          }
          className="flex-1 rounded-md border border-line2 bg-elevated py-2 text-2xs font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Trip circuit
        </button>
        <button
          type="button"
          disabled={!job.quarantine || gate === "LIFTED"}
          title={
            !job.quarantine
              ? "No active quarantine on this job"
              : "Lift clears advisory quarantine for gated entities"
          }
          className="flex-1 rounded-md border border-line py-2 text-2xs font-medium text-mute disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:text-ink"
        >
          Lift quarantine
        </button>
      </div>
    </aside>
  );
}
