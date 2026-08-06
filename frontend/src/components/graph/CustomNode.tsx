import { Handle, Position, type NodeProps } from "reactflow";

export interface NodeDataModel {
  label: string;
  impacted: boolean;
  hop: number;
  urn: string;
  reason?: string;
  dimmed?: boolean;
  blocked?: boolean;
  platform?: string;
  stageRole?: string;
}

function platformLabel(urn: string, name: string): string {
  const u = urn.toLowerCase();
  const n = name.toLowerCase();
  if (u.includes("snowflake")) return "Snowflake";
  if (u.includes("bigquery")) return "BigQuery";
  if (u.includes("looker")) return "Looker";
  if (u.includes("dbt") || n.startsWith("stg_") || n.startsWith("staging_"))
    return "dbt";
  if (u.includes("sqlite")) return "SQLite";
  return "Dataset";
}

function stageRole(hop: number): string {
  if (hop === 0) return "Source";
  if (hop === 1) return "Transform";
  return "Mart";
}

export function CustomNode({ data, selected }: NodeProps<NodeDataModel>) {
  const platform = data.platform ?? platformLabel(data.urn, data.label);
  const stage = data.stageRole ?? stageRole(data.hop);
  const isImpacted = data.impacted;
  const isDimmed = data.dimmed;

  return (
    <div
      className={`relative w-[200px] rounded border bg-panel transition-opacity ${
        isDimmed ? "opacity-30" : "opacity-100"
      } ${
        selected
          ? "border-ink"
          : isImpacted
            ? "border-bad/50"
            : "border-line hover:border-line2"
      }`}
    >
      <div
        className={`absolute bottom-0 left-0 top-0 w-0.5 rounded-l ${
          isImpacted ? "bg-bad" : "bg-line2"
        }`}
        aria-hidden
      />

      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border !border-line !bg-elevated !-left-[5px]"
      />

      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 pl-3.5">
        <span className="truncate text-2xs text-faint">{stage}</span>
        <span className="shrink-0 text-2xs text-mute">{platform}</span>
      </div>

      <div className="flex items-start justify-between gap-2 px-3 py-2 pl-3.5">
        <div
          className="min-w-0 truncate text-xs font-medium tracking-tight text-ink"
          title={data.label}
        >
          {data.label}
        </div>
        <span
          className={`shrink-0 rounded border px-1.5 py-px text-[10px] ${
            isImpacted
              ? "border-bad/30 text-bad"
              : "border-line2 text-mute"
          }`}
        >
          {isImpacted ? "Impacted" : "Open"}
        </span>
      </div>

      {data.reason && (
        <p className="line-clamp-2 border-t border-line px-3 py-1.5 pl-3.5 text-2xs leading-relaxed text-faint">
          {data.reason}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border !border-line !bg-elevated !-right-[5px]"
      />
    </div>
  );
}
