import { useState } from "react";

interface Props {
  riskScore: number;
}

interface Metric {
  key: string;
  label: string;
  weight: number; // 0-100
}

export function RiskRadarChart({ riskScore }: Props) {
  const [hovered, setHovered] = useState<Metric | null>(null);

  // Derive 5 risk dimensions from overall riskScore
  const severityVal = Math.min(100, Math.round(riskScore * 1.1));
  const depthVal = Math.min(100, Math.round(riskScore * 0.9));
  const piiVal = riskScore > 50 ? 80 : 30;
  const prodVal = 100; // High criticality for PROD
  const ownerVal = riskScore > 60 ? 70 : 20;

  const metrics: Metric[] = [
    { key: "severity", label: "Severity", weight: severityVal },
    { key: "depth", label: "Hop Depth", weight: depthVal },
    { key: "pii", label: "PII Exposure", weight: piiVal },
    { key: "prod", label: "Prod Criticality", weight: prodVal },
    { key: "ownership", label: "Ownership Gap", weight: ownerVal },
  ];

  const size = 260;
  const center = size / 2;
  const radius = 80;
  const angleStep = (Math.PI * 2) / metrics.length;

  const points = metrics
    .map((m, i) => {
      const normalized = Math.min(Math.max(m.weight, 0), 100) / 100;
      const r = normalized * radius;
      const angle = i * angleStep - Math.PI / 2;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");

  const levels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="relative flex flex-col items-center justify-center select-none rounded-md border border-line bg-canvas p-3">
      <div className="mb-2 text-2xs uppercase tracking-widest text-faint font-mono">
        Data Reliability Radar
      </div>
      <svg width={size} height={size} className="overflow-visible">
        {/* Radial grid circles */}
        {levels.map((level, idx) => (
          <polygon
            key={idx}
            points={metrics
              .map((_, i) => {
                const r = radius * level;
                const angle = i * angleStep - Math.PI / 2;
                return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
              })
              .join(" ")}
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="1"
            strokeDasharray={idx < 3 ? "2 2" : "none"}
          />
        ))}

        {/* Level markers */}
        {levels.map((level, idx) => (
          <text
            key={`lbl-${idx}`}
            x={center + 4}
            y={center - radius * level + 3}
            fill="#666666"
            className="font-mono text-[8px]"
          >
            {level * 100}%
          </text>
        ))}

        {/* Metric axes & labels */}
        {metrics.map((m, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);

          const labelR = radius + 22;
          const labelX = center + labelR * Math.cos(angle);
          const labelY = center + labelR * Math.sin(angle);

          return (
            <g key={m.key}>
              <line
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="#1a1a1a"
                strokeWidth="1"
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#888888"
                className="font-mono text-[9px] uppercase tracking-wide font-medium"
              >
                {m.label}
              </text>
            </g>
          );
        })}

        {/* Radar polygon */}
        <polygon
          points={points}
          fill="rgba(255, 255, 255, 0.12)"
          stroke="#ededed"
          strokeWidth="1.5"
          className="transition-all duration-300"
        />

        {/* Interactive vertices */}
        {metrics.map((m, i) => {
          const normalized = Math.min(Math.max(m.weight, 0), 100) / 100;
          const r = normalized * radius;
          const angle = i * angleStep - Math.PI / 2;
          const x = center + r * Math.cos(angle);
          const y = center + r * Math.sin(angle);

          return (
            <circle
              key={`dot-${m.key}`}
              cx={x}
              cy={y}
              r="3.5"
              fill="#ededed"
              stroke="#0a0a0a"
              strokeWidth="1.5"
              className="cursor-pointer hover:scale-150 transition-transform"
              onMouseEnter={() => setHovered(m)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>

      {hovered && (
        <div className="absolute top-2 right-2 rounded border border-line bg-elevated px-2 py-1 font-mono text-2xs text-ink shadow-lg">
          <span className="text-faint">{hovered.label}:</span>{" "}
          <span className="font-bold">{hovered.weight}</span>/100
        </div>
      )}
    </div>
  );
}
