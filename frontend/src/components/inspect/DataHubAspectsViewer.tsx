import { useState } from "react";
import type { DataHubAspectPayload } from "../../lib/types";

interface Props {
  aspects?: DataHubAspectPayload[];
}

export function DataHubAspectsViewer({ aspects }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (!aspects || aspects.length === 0) {
    return (
      <div className="rounded-md border border-line bg-canvas p-4 text-center font-mono text-xs text-muted">
        No DataHub aspects recorded for this run.
      </div>
    );
  }

  const current = aspects[selectedIdx] || aspects[0];

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <span className="text-2xs uppercase tracking-widest text-faint">
          DataHub Aspects ({aspects.length})
        </span>
        <span className="rounded bg-elevated px-2 py-0.5 text-2xs text-muted border border-line">
          Job aspect snapshot
        </span>
      </div>

      {/* Aspect tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
        {aspects.map((asp, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedIdx(idx)}
            className={`rounded px-2.5 py-1 text-2xs transition-colors whitespace-nowrap ${
              selectedIdx === idx
                ? "bg-elevated text-ink font-semibold border border-line"
                : "text-muted hover:text-ink hover:bg-elevated/50"
            }`}
          >
            {asp.aspectName}
          </button>
        ))}
      </div>

      {/* Aspect Detail Box */}
      <div className="rounded-md border border-line bg-canvas p-3 space-y-2">
        <div className="text-2xs text-faint truncate">
          URN: <span className="text-muted">{current.urn}</span>
        </div>
        <div className="text-2xs text-faint">
          Aspect: <span className="text-accent font-semibold">{current.aspectName}</span>
        </div>
        <pre className="max-h-60 overflow-y-auto rounded bg-panel p-2.5 text-2xs text-ink custom-scrollbar border border-line">
          {JSON.stringify(current.aspectValue, null, 2)}
        </pre>
      </div>
    </div>
  );
}
