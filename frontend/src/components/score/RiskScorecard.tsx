interface Props {
  score: number;
  impacted: number;
  total: number;
}

export function RiskScorecard({ score, impacted, total }: Props) {
  const level = score >= 75 ? "high" : score >= 40 ? "medium" : "low";
  const bar = Math.min(100, Math.max(0, score));

  return (
    <div className="rounded-md border border-line bg-canvas p-3">
      <div className="text-2xs uppercase tracking-wide text-faint">Risk</div>
      <div className="mt-1 flex items-end gap-2">
        <span className="font-mono text-3xl font-medium tabular-nums tracking-tight text-ink">
          {score}
        </span>
        <span className="mb-1 text-2xs text-mute">
          {level} · {impacted}/{total} selective
        </span>
      </div>
      <div className="mt-2 h-px overflow-hidden bg-line2">
        <div
          className="h-full bg-ink"
          style={{ width: `${bar}%` }}
        />
      </div>
    </div>
  );
}
