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
}: EdgeProps<{ hot?: boolean; label?: string }>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const isHot = Boolean(data?.hot);
  const stroke = isHot ? "#ff5c5c" : "#262626";

  return (
    <>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={stroke}
        strokeWidth={isHot ? 1.5 : 1}
        className="pointer-events-none"
        style={style}
      />
      {data?.label && (
        <foreignObject
          width={100}
          height={22}
          x={labelX - 50}
          y={labelY - 11}
          className="overflow-visible pointer-events-none"
        >
          <div
            className={`flex h-full items-center justify-center rounded border px-1.5 text-[10px] ${
              isHot
                ? "border-bad/30 bg-panel text-bad"
                : "border-line bg-panel text-faint"
            }`}
          >
            <span className="truncate">{data.label}</span>
          </div>
        </foreignObject>
      )}
    </>
  );
}
