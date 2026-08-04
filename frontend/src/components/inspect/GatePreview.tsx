import type { GateStatus } from "../../lib/types";

interface Props {
  status: GateStatus;
  tags: string[];
  properties: Record<string, string>;
}

export function GatePreview({ status, tags, properties }: Props) {
  const blocked = status === "BLOCKED";
  return (
    <div className="rounded-md border border-line bg-canvas p-3">
      <div className="text-2xs uppercase tracking-wide text-faint">
        Consumer gate
      </div>
      <div
        className={`mt-1 text-base font-medium tracking-tight ${blocked ? "text-bad" : "text-good"}`}
      >
        {status}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-mute">
        {blocked
          ? "Context redacted for MidSphere-aware clients. Advisory quarantine in DataHub (tags and structured properties). Not global MCP denial."
          : "Full context allowed for this entity under MidSphere gate policy."}
      </p>
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded border border-line px-1.5 py-0.5 font-mono text-2xs text-mute"
            >
              {t.replace("urn:li:tag:", "")}
            </span>
          ))}
        </div>
      )}
      {Object.keys(properties).length > 0 && (
        <dl className="mt-3 space-y-1 font-mono text-2xs text-faint">
          {Object.entries(properties).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt>{k}</dt>
              <dd className="text-mute">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
