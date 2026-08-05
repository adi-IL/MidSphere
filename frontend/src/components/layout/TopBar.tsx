import { SCENARIOS, type ScenarioId } from "../../lib/types";

interface Props {
  connection: string;
  source: "api" | "demo";
  risk: number;
  scanning?: boolean;
  activeScenario?: ScenarioId;
  onSelectScenario?: (id: ScenarioId) => void;
  onScan: () => void;
}

export function TopBar({
  connection,
  source,
  risk,
  scanning = false,
  activeScenario = "healthcare",
  onSelectScenario,
  onScan,
}: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-canvas px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-sm border border-line2 bg-elevated text-[10px] font-medium tracking-tight text-ink">
          M
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium tracking-tight text-ink">
            MidSphere
          </div>
          <div className="truncate text-2xs text-mute">
            Context circuit-breaker for DataHub
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {onSelectScenario && (
          <select
            value={activeScenario}
            onChange={(e) => onSelectScenario(e.target.value as ScenarioId)}
            className="rounded-md border border-line bg-panel px-2 py-1 font-mono text-2xs text-ink focus:outline-none focus:border-line2"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        <div className="hidden items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1 text-2xs text-mute sm:flex">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              scanning
                ? "bg-good agent-pulse"
                : source === "api"
                  ? "bg-good"
                  : "bg-warn"
            }`}
          />
          <span className="max-w-[14rem] truncate">{connection}</span>
          {source === "demo" && !scanning && (
            <span className="text-faint">demo</span>
          )}
        </div>
        <div className="rounded-md border border-line bg-panel px-2.5 py-1 font-mono text-2xs text-mute">
          risk{" "}
          <span
            className={
              risk >= 60 ? "text-bad" : risk >= 40 ? "text-warn" : "text-ink"
            }
          >
            {risk}
          </span>
        </div>
        <button
          type="button"
          onClick={onScan}
          disabled={scanning}
          className="rounded-md bg-ink px-3 py-1.5 text-2xs font-medium text-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1.5"
        >
          <span>{scanning ? "Scanning…" : "Run scan"}</span>
          <kbd className="hidden font-mono text-[9px] text-faint sm:inline">⌘↵</kbd>
        </button>
      </div>
    </header>
  );
}

