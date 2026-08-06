import { useCallback, useState } from "react";
import type { GateDecision, GateStatus } from "../../lib/types";
import { fetchGate } from "../../lib/api";

interface Props {
  status: GateStatus;
  tags: string[];
  properties: Record<string, string>;
  /** URN to probe via GET /v1/gate/{urn} (live API decision). */
  probeUrn?: string | null;
}

export function GatePreview({ status, tags, properties, probeUrn }: Props) {
  const blocked = status === "BLOCKED";
  const [probe, setProbe] = useState<GateDecision | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const onProbe = useCallback(async () => {
    if (!probeUrn) return;
    setProbing(true);
    setProbeError(null);
    const res = await fetchGate(probeUrn);
    setProbing(false);
    if (!res) {
      setProbe(null);
      setProbeError("Gate API unavailable (offline sample or API down).");
      return;
    }
    setProbe(res);
  }, [probeUrn]);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-line bg-canvas p-3">
        <div className="text-2xs font-medium tracking-wide text-faint">
          Consumer gate (job view)
        </div>
        <div
          className={`mt-1 text-base font-medium tracking-tight ${
            blocked ? "text-bad" : "text-good"
          }`}
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

      {probeUrn && (
        <div className="rounded-md border border-line bg-canvas p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-2xs font-medium tracking-wide text-faint">
              Live API probe
            </div>
            <button
              type="button"
              onClick={() => void onProbe()}
              disabled={probing}
              className="rounded border border-line px-2 py-1 text-2xs text-mute hover:text-ink disabled:opacity-50"
            >
              {probing ? "Probing..." : "GET /v1/gate"}
            </button>
          </div>
          <p className="mt-1 truncate font-mono text-2xs text-faint" title={probeUrn}>
            {probeUrn}
          </p>
          {probeError && (
            <p className="mt-2 text-2xs text-warn">{probeError}</p>
          )}
          {probe && (
            <dl className="mt-2 space-y-1 font-mono text-2xs">
              <div className="flex justify-between gap-2">
                <dt className="text-faint">status</dt>
                <dd
                  className={
                    probe.status === "BLOCKED" ? "text-bad" : "text-good"
                  }
                >
                  {probe.status}
                </dd>
              </div>
              {probe.job_id && (
                <div className="flex justify-between gap-2">
                  <dt className="text-faint">job_id</dt>
                  <dd className="truncate text-mute" title={probe.job_id}>
                    {probe.job_id.slice(0, 12)}...
                  </dd>
                </div>
              )}
              {probe.risk_score != null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-faint">risk</dt>
                  <dd className="text-mute">{probe.risk_score}</dd>
                </div>
              )}
              <div className="pt-1 text-faint leading-relaxed">
                {probe.reason}
              </div>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
