import { useState } from "react";
import { getSmoothStepPath, type EdgeProps } from "reactflow";

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}: EdgeProps<{ hot?: boolean; label?: string; volume?: string; piiCount?: number }>) {
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  });

  const isHot = Boolean(data?.hot);
  const strokeColor = isHot ? "#ef4444" : "#10b981";
  const glowColor = isHot ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.2)";

  return (
    <>
      {/* Outer glow stroke on hover/select/hot */}
      <path
        d={edgePath}
        fill="none"
        stroke={glowColor}
        strokeWidth={isHot ? 6 : hovered ? 5 : 0}
        className="transition-all duration-300 pointer-events-none"
      />

      {/* Main edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isHot ? 2.5 : 1.5}
        strokeDasharray={isHot ? "8, 4" : "4, 4"}
        className={`transition-all duration-200 cursor-pointer ${
          isHot ? "animate-[dash_1s_linear_infinite]" : ""
        }`}
        style={style}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Floating metric pill at midpoint */}
      <foreignObject
        width={130}
        height={32}
        x={labelX - 65}
        y={labelY - 16}
        className="overflow-visible pointer-events-auto"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className={`flex items-center justify-center gap-1 rounded-full border px-2 py-1 font-mono text-[9px] font-semibold backdrop-blur-md shadow-lg transition-all duration-200 ${
            hovered || selected
              ? "scale-110 border-ink bg-panel text-ink shadow-xl z-30"
              : isHot
                ? "border-bad/60 bg-bad/20 text-bad shadow-bad/20"
                : "border-line bg-panel/90 text-mute hover:text-ink"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isHot ? "bg-bad animate-ping" : "bg-good"
            }`}
          />
          <span className="truncate">
            {data?.label || (isHot ? "12 PII fields" : "Clean flow")}
          </span>
        </div>

        {/* Hover Tooltip Story */}
        {hovered && (
          <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-48 rounded-lg border border-line bg-panel/95 p-2.5 font-mono text-[10px] text-ink shadow-2xl backdrop-blur-md z-50 pointer-events-none space-y-1">
            <div className="flex items-center justify-between border-b border-line/60 pb-1 text-2xs uppercase tracking-wider text-faint">
              <span>Edge Telemetry</span>
              <span className={isHot ? "text-bad font-bold" : "text-good"}>
                {isHot ? "BLOCKED" : "SAFE"}
              </span>
            </div>
            <div className="flex justify-between text-2xs">
              <span className="text-faint">Volume:</span>
              <span className="text-ink font-medium">{data?.volume || "1.2M events/s"}</span>
            </div>
            <div className="flex justify-between text-2xs">
              <span className="text-faint">PII Exposure:</span>
              <span className={isHot ? "text-bad font-bold" : "text-good"}>
                {data?.piiCount ? `${data.piiCount} fields` : isHot ? "3 Sensitive Fields" : "None"}
              </span>
            </div>
            <div className="flex justify-between text-2xs">
              <span className="text-faint">Routing:</span>
              <span className="text-mute">Orthogonal 45°</span>
            </div>
          </div>
        )}
      </foreignObject>
    </>
  );
}
