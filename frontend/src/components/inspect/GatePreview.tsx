import type { GateStatus } from "../../lib/types";

interface Props {
  status: GateStatus;
  tags: string[];
  properties: Record<string, string>;
}

export function GatePreview({ status, tags, properties }: Props) {
  const blocked = status === "BLOCKED";
  return (
    <div
      className={`rounded-lg border p-3 ${
        blocked
          ? "border-broken/40 bg-broken/10"
          : "border-healthy/40 bg-healthy/10"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-dim">
        Consumer Gate — what would an agent see?
      </div>
      <div
        className={`mt-1 text-lg font-semibold ${blocked ? "text-broken" : "text-healthy"}`}
      >
        {status}
      </div>
      {blocked ? (
        <p className="mt-2 text-xs text-muted">
          Context redacted. Reason: advisory quarantine tags + gate_status.
          Review PR + MBOM before lift.
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Full schema and lineage context allowed for this entity.
        </p>
      )}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded bg-app px-1.5 py-0.5 font-mono text-[10px] text-muted"
            >
              {t.replace("urn:li:tag:", "")}
            </span>
          ))}
        </div>
      )}
      {Object.keys(properties).length > 0 && (
        <dl className="mt-3 space-y-1 font-mono text-[10px] text-dim">
          {Object.entries(properties).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt>{k}</dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
