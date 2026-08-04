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
  { id: "fix", label: "Fix / PR" },
  { id: "mbom", label: "MBOM" },
  { id: "raw", label: "Raw" },
];

export function InspectorDrawer({ job, selectedUrn, tab, onTab }: Props) {
  const node = job.blast_radius.nodes.find((n) => n.urn === selectedUrn);
  const gate = job.quarantine?.gateStatus ?? "OPEN";

  return (
    <aside className="flex w-[400px] shrink-0 flex-col border-l border-elevated bg-panel">
      <div className="border-b border-elevated p-3">
        <div className="text-[11px] uppercase tracking-wider text-dim">
          Inspector
        </div>
        <div className="mt-1 text-sm font-semibold">
          {node?.name ?? "Select a node"}
        </div>
        <div className="mt-1 truncate font-mono text-[10px] text-muted">
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

      <div className="flex gap-1 overflow-x-auto border-b border-elevated px-2 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`rounded px-2 py-1 text-xs ${
              tab === t.id
                ? "bg-elevated text-primary"
                : "text-muted hover:bg-app"
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
                className="rounded-lg border border-elevated bg-app/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{f.type}</span>
                  <span className="rounded bg-broken/15 px-1.5 py-0.5 text-[10px] text-broken">
                    {f.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{f.rationale}</p>
                <p className="mt-2 font-mono text-[10px] text-dim">
                  {f.evidence}
                </p>
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
            <p className="text-xs leading-relaxed text-muted">
              Advisory quarantine in DataHub + MidSphere Consumer Gate. MCP does
              not auto-deny every third-party reader — we enforce at the gate.
            </p>
          </div>
        )}

        {tab === "fix" && (
          <pre className="overflow-x-auto rounded-lg border border-elevated bg-app p-3 font-mono text-[11px] leading-relaxed text-healthy">
            {DEMO_DIFF}
          </pre>
        )}

        {tab === "mbom" && (
          <article className="prose prose-invert prose-sm max-w-none text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {DEMO_MBOM}
            </ReactMarkdown>
            {job.mbom?.document_urn && (
              <p className="mt-3 font-mono text-[10px] text-dim">
                {job.mbom.document_urn}
              </p>
            )}
          </article>
        )}

        {tab === "raw" && (
          <pre className="overflow-x-auto rounded-lg border border-elevated bg-app p-3 font-mono text-[10px] text-muted">
            {JSON.stringify(job, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex gap-2 border-t border-elevated p-3">
        <button
          type="button"
          className="flex-1 rounded-md bg-broken/90 py-2 text-xs font-semibold text-white"
        >
          Trip Circuit
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border border-elevated py-2 text-xs font-semibold text-muted"
        >
          Lift Quarantine
        </button>
      </div>
    </aside>
  );
}
