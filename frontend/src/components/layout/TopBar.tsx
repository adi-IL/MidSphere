import { Github } from "lucide-react";
import { SCENARIOS, type ScenarioId } from "../../lib/types";
import type { CatalogState, ConnectionState } from "../../lib/status";

/** Public source repository (OSS submission surface). */
export const MIDSPHERE_GITHUB_URL = "https://github.com/adi-IL/MidSphere";

interface Props {
  connection: ConnectionState;
  /** Whether the canvas job came from API or offline sample (honesty). */
  dataSource?: "api" | "demo";
  catalog: CatalogState;
  scanning?: boolean;
  activeScenario?: ScenarioId;
  onSelectScenario?: (id: ScenarioId) => void;
  onScan: () => void;
}

const SCENARIO_SHORT: Record<ScenarioId, string> = {
  healthcare: "Hospital",
  ecommerce: "Retail",
  nyctaxi: "Taxi",
};

function StatusDot({
  on,
  pulse,
  label,
}: {
  on: boolean;
  pulse?: boolean;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-mute">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          on ? "bg-good" : "bg-faint"
        } ${pulse ? "agent-pulse" : ""}`}
        aria-hidden
      />
      <span className={on ? "text-ink" : "text-mute"}>{label}</span>
    </span>
  );
}

export function TopBar({
  connection,
  dataSource = "demo",
  catalog,
  scanning = false,
  activeScenario = "healthcare",
  onSelectScenario,
  onScan,
}: Props) {
  const apiLive = connection === "live";
  const gmsOn = catalog === "on";
  // Do not say "Live" when the canvas is still sample data under a healthy API.
  const connectionLabel = scanning
    ? "Running"
    : connection === "checking"
      ? "Checking"
      : !apiLive
        ? "Offline"
        : dataSource === "demo"
          ? "API · Sample"
          : "API · Job";
  const connectionOn = scanning || apiLive;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-line bg-canvas px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <img
          src="/logo-mark.png"
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-sm object-contain"
          aria-hidden
        />
        <span className="text-sm font-medium tracking-tight text-ink">
          MidSphere
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        {onSelectScenario && (
          <div
            className="hidden items-center rounded border border-line bg-panel p-0.5 sm:flex"
            role="tablist"
            aria-label="Scenario"
          >
            {SCENARIOS.map((s) => {
              const active = s.id === activeScenario;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelectScenario(s.id)}
                  className={`rounded-sm px-2.5 py-1 text-2xs transition-colors ${
                    active
                      ? "bg-elevated text-ink"
                      : "text-mute hover:text-ink"
                  }`}
                >
                  {SCENARIO_SHORT[s.id] ?? s.name}
                </button>
              );
            })}
          </div>
        )}

        {onSelectScenario && (
          <select
            value={activeScenario}
            onChange={(e) => onSelectScenario(e.target.value as ScenarioId)}
            className="rounded border border-line bg-panel px-2 py-1 text-2xs text-ink focus:outline-none focus:border-line2 sm:hidden"
            aria-label="Scenario"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {SCENARIO_SHORT[s.id] ?? s.name}
              </option>
            ))}
          </select>
        )}

        <div className="hidden items-center gap-3 border-l border-line pl-3 md:flex">
          <StatusDot
            on={connectionOn}
            pulse={scanning}
            label={connectionLabel}
          />
          <StatusDot on={gmsOn} label={gmsOn ? "GMS" : "GMS off"} />
        </div>

        <a
          href={MIDSPHERE_GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Source on GitHub"
          aria-label="Open MidSphere source code on GitHub"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-mute transition-colors hover:border-line2 hover:text-ink"
        >
          <Github className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </a>

        <button
          type="button"
          onClick={onScan}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 rounded bg-ink px-3 py-1.5 text-2xs font-medium text-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>{scanning ? "Running" : "Run"}</span>
          <kbd className="hidden font-mono text-[10px] text-faint sm:inline">
            ⌘↵
          </kbd>
        </button>
      </div>
    </header>
  );
}
