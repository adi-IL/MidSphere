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

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-line bg-panel">
      <div className="border-b border-line p-3">
        <div className="text-2xs uppercase tracking-wide text-faint">
          Inspector
        </div>
        <div className="mt-1 text-sm font-medium tracking-tight text-ink">
          {node?.name ?? "Select a node"}
        </div>
        <div className="mt-1 truncate font-mono text-2xs text-mute">
          {selectedUrn}
        </div>
        <div className="mt-3">
          <RiskScorecard
            score={job.blast_radius.risk_score}
            impacted={job.blast_radius.nodes.filter((n) => n.impacted).length}
            total={job.blast_radius.nodes.length}
          />
        </div>
      </div>

      <div className="flex gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`rounded px-2 py-1 text-2xs ${
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
                node?.impacted && gate === "BLOCKED" ? "BLOCKED" : "OPEN"
              }
              tags={job.quarantine?.tagsApplied ?? []}
              properties={job.quarantine?.properties ?? {}}
            />
          </div>
        )}

        {tab === "fix" && (
          <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-2xs leading-relaxed text-mute">
            {DEMO_DIFF}
          </pre>
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
          </article>
        )}

        {tab === "raw" && (
          <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-2xs text-mute">
            {JSON.stringify(job, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex gap-2 border-t border-line p-3">
        <button
          type="button"
          className="flex-1 rounded-md border border-line2 bg-elevated py-2 text-2xs font-medium text-ink"
        >
          Trip circuit
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border border-line py-2 text-2xs font-medium text-mute"
        >
          Lift quarantine
        </button>
      </div>
    </aside>
  );
}
