interface Props {
  score: number;
  impacted: number;
  total: number;
}

export function RiskScorecard({ score, impacted, total }: Props) {
  const level = score >= 75 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
  const bar = Math.min(100, Math.max(0, score));

  return (
    <div className="rounded-lg border border-elevated bg-app/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-dim">Risk</div>
      <div className="mt-1 flex items-end gap-2">
        <span className="font-mono text-4xl font-semibold tabular-nums text-broken">
          {score}
        </span>
        <span className="mb-1 text-xs text-muted">
          {level} · {impacted}/{total} entities · selective
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-broken"
          style={{ width: `${bar}%` }}
        />
      </div>
    </div>
  );
}
