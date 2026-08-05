import { useEffect, useState } from "react";

export interface TimeStep {
  step: number;
  time: string;
  stage: string;
  label: string;
  description: string;
}

export const TIME_STEPS: TimeStep[] = [
  { step: 0, time: "09:20:00", stage: "Baseline", label: "Pre-Incident Baseline", description: "All lineage nodes healthy & OPEN" },
  { step: 1, time: "09:24:12", stage: "ContextSentinel", label: "Quality Anomaly Detected", description: "Audit finding triggered on ingestion source" },
  { step: 2, time: "09:28:45", stage: "CascadeAnalyzer", label: "Contamination Propagated", description: "Blast radius calculated across downstream hops" },
  { step: 3, time: "09:31:02", stage: "CircuitBreaker", label: "Circuit Breaker Tripped", description: "Advisory quarantine & BLOCKED gate status applied" },
  { step: 4, time: "09:35:10", stage: "MBOMEngine", label: "Attested & Remediated", description: "Fix diff & MBOM audit attestation published" },
];

interface Props {
  currentStep: number;
  onStepChange: (step: number) => void;
  activeScenarioLabel?: string;
}

export function TimeTravelBar({ currentStep, onStepChange, activeScenarioLabel }: Props) {
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
      {/* Step Info Callout Pill */}
      <div className="flex items-center gap-2 rounded-full border border-line bg-panel/95 px-3.5 py-1.5 font-mono text-[10px] shadow-2xl backdrop-blur-md">
        <span className="font-bold text-accent uppercase tracking-wider">{activeInfo.time}</span>
        <span className="text-faint">·</span>
        <span className="font-semibold text-ink">{activeInfo.label}</span>
        <span className="text-faint">·</span>
        <span className="text-mute">{activeInfo.description}</span>
      </div>

      {/* Controller Slider Bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel/95 px-4 py-2 shadow-2xl backdrop-blur-md">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-canvas text-ink hover:border-faint transition-all shadow-inner"
          title={isPlaying ? "Pause Time Travel" : `Play Forensic Ripple for ${activeScenarioLabel || "Pipeline"}`}
        >
          {isPlaying ? (
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        {/* Time Slider */}
        <div className="flex flex-col gap-1 w-72">
          <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-faint">
            <span>09:20 Baseline</span>
            <span className="text-ink font-semibold">Forensic Time Travel</span>
            <span>09:35 Attested</span>
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
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-canvas accent-accent"
          />
        </div>

        {/* Reset / Live Toggle */}
        <button
          type="button"
          onClick={() => {
            setIsPlaying(false);
            onStepChange(TIME_STEPS.length - 1);
          }}
          className="rounded-lg border border-line bg-canvas px-2.5 py-1 font-mono text-[9px] font-semibold text-mute hover:text-ink hover:border-faint transition-colors"
        >
          LIVE
        </button>
      </div>
    </div>
  );
}
