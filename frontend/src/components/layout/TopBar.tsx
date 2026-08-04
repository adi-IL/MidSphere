import { Activity, Radar } from "lucide-react";

interface Props {
  connection: string;
  source: "api" | "demo";
  risk: number;
  onScan: () => void;
}

export function TopBar({ connection, source, risk, onScan }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-elevated bg-panel/80 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand/20 text-brand">
          <Radar size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">MidSphere</div>
          <div className="text-[11px] text-muted">
            Context Circuit-Breaker ·{" "}
            <span className="text-brand">DataHub</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-elevated bg-app/60 px-3 py-1 text-xs text-muted sm:flex">
          <Activity size={12} className="text-healthy" />
          {connection}
          {source === "demo" && (
            <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[10px] text-warn">
              DEMO
            </span>
          )}
        </div>
        <div className="rounded-md border border-elevated bg-app px-2.5 py-1 font-mono text-xs">
          RISK <span className="text-broken">{risk}</span>
        </div>
        <button
          type="button"
          onClick={onScan}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-panel transition hover:brightness-110"
        >
          Run Scan
        </button>
      </div>
    </header>
  );
}
