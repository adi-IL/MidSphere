import { useEffect, useState } from "react";

export interface TimeStep {
  step: number;
  time: string;
  stage: string;
  label: string;
  description: string;
}

export const TIME_STEPS: TimeStep[] = [
  {
    step: 0,
    time: "09:20",
    stage: "Baseline",
    label: "Baseline",
    description: "All nodes open",
  },
  {
    step: 1,
    time: "09:24",
    stage: "ContextSentinel",
    label: "Finding",
    description: "Quality anomaly on source",
  },
  {
    step: 2,
    time: "09:28",
    stage: "CascadeAnalyzer",
    label: "Cascade",
    description: "Blast radius across hops",
  },
  {
    step: 3,
    time: "09:31",
    stage: "CircuitBreaker",
    label: "Gate",
    description: "Advisory quarantine applied",
  },
  {
    step: 4,
    time: "09:35",
    stage: "MBOMEngine",
    label: "Attested",
    description: "Fix and MBOM published",
  },
];

interface Props {
  currentStep: number;
  onStepChange: (step: number) => void;
  activeScenarioLabel?: string;
}

export function TimeTravelBar({
  currentStep,
  onStepChange,
  activeScenarioLabel,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (currentStep >= TIME_STEPS.length - 1) {
        setIsPlaying(false);
      } else {
        onStepChange(currentStep + 1);
      }
    }, 1400);
    return () => clearInterval(interval);
  }, [isPlaying, currentStep, onStepChange]);

  const activeInfo = TIME_STEPS[currentStep] || TIME_STEPS[0];

  return (
    <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5">
      <div className="flex items-center gap-2 rounded border border-line bg-panel px-3 py-1.5 text-2xs text-mute">
        <span className="font-mono tabular-nums text-ink">{activeInfo.time}</span>
        <span className="text-line2">·</span>
        <span className="text-ink">{activeInfo.label}</span>
        <span className="text-line2">·</span>
        <span className="hidden sm:inline">{activeInfo.description}</span>
      </div>

      <div className="flex items-center gap-3 rounded border border-line bg-panel px-3 py-2">
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex h-7 w-7 items-center justify-center rounded border border-line bg-canvas text-ink hover:border-line2"
          title={
            isPlaying
              ? "Pause"
              : `Play timeline for ${activeScenarioLabel || "pipeline"}`
          }
        >
          {isPlaying ? (
            <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-3 w-3 fill-current" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <div className="flex w-64 flex-col gap-1">
          <div className="flex justify-between font-mono text-[10px] text-faint">
            <span>Baseline</span>
            <span className="text-mute">Timeline</span>
            <span>Live</span>
          </div>
          <input
            type="range"
            min={0}
            max={TIME_STEPS.length - 1}
            value={currentStep}
            onChange={(e) => {
              setIsPlaying(false);
              onStepChange(Number(e.target.value));
            }}
            className="h-1 w-full cursor-pointer appearance-none rounded bg-elevated accent-ink"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setIsPlaying(false);
            onStepChange(TIME_STEPS.length - 1);
          }}
          className="rounded border border-line bg-canvas px-2 py-1 text-[10px] text-mute hover:text-ink"
        >
          Live
        </button>
      </div>
    </div>
  );
}
