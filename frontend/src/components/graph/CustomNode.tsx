import { useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export interface NodeDataModel {
  label: string;
  impacted: boolean;
  hop: number;
  urn: string;
  reason?: string;
  dimmed?: boolean;
  blocked?: boolean;
  rows?: string;
  latency?: string;
  riskScore?: number;
  owner?: string;
  downstreamCount?: number;
}

function getPlatformMeta(urn: string, name: string) {
  const u = urn.toLowerCase();
  const n = name.toLowerCase();
  if (u.includes("snowflake"))
    return { label: "Snowflake", icon: "❄️", badgeBg: "bg-cyan-950/60 border-cyan-800/40 text-cyan-300" };
  if (u.includes("bigquery"))
    return { label: "BigQuery", icon: "⚡", badgeBg: "bg-amber-950/60 border-amber-800/40 text-amber-300" };
  if (u.includes("looker"))
    return { label: "Looker", icon: "📊", badgeBg: "bg-purple-950/60 border-purple-800/40 text-purple-300" };
  if (u.includes("dbt") || n.startsWith("stg_") || n.startsWith("staging_"))
    return { label: "dbt model", icon: "🟧", badgeBg: "bg-orange-950/60 border-orange-800/40 text-orange-300" };
  if (u.includes("sqlite"))
    return { label: "SQLite", icon: "📦", badgeBg: "bg-blue-950/60 border-blue-800/40 text-blue-300" };
  return { label: "DataHub Asset", icon: "📄", badgeBg: "bg-[#18181b] border-[#27272a] text-zinc-400" };
}

function getStageRole(hop: number): string {
  if (hop === 0) return "INGESTION SOURCE";
  if (hop === 1) return "TRANSFORMATION";
  return "ANALYTICS MART";
}

export function CustomNode({ data, selected }: NodeProps<NodeDataModel>) {
  const [hovered, setHovered] = useState(false);
  const platform = getPlatformMeta(data.urn, data.label);
  const stageRole = getStageRole(data.hop);

  const isImpacted = data.impacted;
  const isDimmed = data.dimmed;
  const risk = data.riskScore ?? (isImpacted ? 88 : 0);

  // Risk heat bar color
  const riskColor =
    risk >= 70 ? "bg-red-500 shadow-red-500/50" : risk >= 35 ? "bg-amber-500 shadow-amber-500/50" : "bg-emerald-500 shadow-emerald-500/50";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative w-[235px] rounded-xl border bg-[#0a0a0c]/95 p-3.5 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden ${
        isDimmed ? "opacity-20 blur-[0.5px] scale-95" : "opacity-100"
      } ${
        selected
          ? "ring-2 ring-zinc-200 border-zinc-300 scale-[1.03] z-40 shadow-[0_0_25px_rgba(255,255,255,0.15)]"
          : isImpacted
            ? "border-red-600/70 bg-gradient-to-b from-red-950/20 via-[#0a0a0c] to-[#0a0a0c] shadow-[0_0_20px_rgba(239,68,68,0.15)]"
            : "border-[#1e1e24] hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]"
      }`}
    >
      {/* Left Status Accent Indicator Bar */}
      <div
        className={`absolute top-0 bottom-0 left-0 w-[3.5px] transition-all ${
          isImpacted ? "bg-red-500 shadow-[0_0_10px_#ef4444]" : "bg-emerald-500 shadow-[0_0_10px_#10b981]"
        }`}
      />

      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Left}
        className={`!h-3 !w-3 !border-2 !-left-[6px] transition-transform ${
          isImpacted ? "!bg-red-500 !border-[#0a0a0c]" : "!bg-emerald-500 !border-[#0a0a0c]"
        }`}
      />

      {/* Header: Stage role + Platform badge */}
      <div className="flex items-center justify-between gap-1.5 border-b border-[#1f1f27] pb-2 pl-1">
        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 truncate">
          {stageRole}
        </span>
        <span
          className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-tight ${platform.badgeBg}`}
        >
          <span className="text-[10px]">{platform.icon}</span>
          <span>{platform.label}</span>
        </span>
      </div>

      {/* Body: Dataset Title & Status Pill */}
      <div className="mt-2.5 flex items-center justify-between gap-2 pl-1">
        <div className="font-mono text-xs font-bold tracking-tight text-zinc-100 truncate" title={data.label}>
          {data.label}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
            isImpacted
              ? "bg-red-950/80 text-red-400 border border-red-800/60 shadow-[0_0_8px_rgba(239,68,68,0.25)] animate-pulse"
              : "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isImpacted ? "bg-red-500 animate-ping" : "bg-emerald-400"
            }`}
          />
          {isImpacted ? "IMPACTED" : "OPEN"}
        </span>
      </div>

      {/* Rationale description */}
      {data.reason && (
        <p className="mt-2 line-clamp-2 font-mono text-[10px] leading-relaxed text-zinc-400 border-t border-[#18181f] pt-1.5 pl-1">
          {data.reason}
        </p>
      )}

      {/* Footer Metrics Grid + Micro Heat Bar */}
      <div className="mt-2.5 space-y-1.5 pl-1">
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#1b1b22] bg-[#050507]/90 p-1.5 text-center font-mono text-[9px]">
          <div>
            <div className="text-[8px] uppercase tracking-wider text-zinc-400">Rows</div>
            <div className="font-semibold text-zinc-200">{data.rows || "1.2M"}</div>
          </div>
          <div className="border-x border-[#1b1b22]">
            <div className="text-[8px] uppercase tracking-wider text-zinc-400">Latency</div>
            <div className="font-semibold text-zinc-200">{data.latency || "18ms"}</div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-wider text-zinc-400">Risk</div>
            <div className={`font-bold ${isImpacted ? "text-red-400" : "text-emerald-400"}`}>
              {risk}
            </div>
          </div>
        </div>

        {/* Micro Risk Heat Bar */}
        <div className="h-1 w-full rounded-full bg-[#18181e] overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${riskColor}`}
            style={{ width: `${Math.max(6, risk)}%` }}
          />
        </div>
      </div>

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Right}
        className={`!h-3 !w-3 !border-2 !-right-[6px] transition-transform ${
          isImpacted ? "!bg-red-500 !border-[#0a0a0c]" : "!bg-emerald-500 !border-[#0a0a0c]"
        }`}
      />

      {/* Hover Story Floating Tooltip */}
      {hovered && !isDimmed && (
        <div className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 w-60 rounded-xl border border-[#272730] bg-[#0c0c10]/98 p-3 font-mono text-[10px] text-zinc-100 shadow-2xl backdrop-blur-2xl z-50 pointer-events-none space-y-1.5 border-t-2 border-t-zinc-400">
          <div className="flex items-center justify-between border-b border-[#1f1f28] pb-1.5">
            <span className="font-bold text-zinc-100">{data.label}</span>
            <span className={`text-[9px] uppercase font-bold ${isImpacted ? "text-red-400" : "text-emerald-400"}`}>
              {isImpacted ? "QUARANTINED" : "OPEN"}
            </span>
          </div>
          <div className="flex justify-between text-2xs">
            <span className="text-zinc-400">Data Platform:</span>
            <span className="text-zinc-200 font-semibold">{platform.label}</span>
          </div>
          <div className="flex justify-between text-2xs">
            <span className="text-zinc-400">Owner:</span>
            <span className="text-zinc-200">{data.owner || "Data Engineering Platform"}</span>
          </div>
          <div className="flex justify-between text-2xs">
            <span className="text-zinc-400">Freshness SLA:</span>
            <span className={isImpacted ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}>
              {isImpacted ? "72h Stale (SLA Breach)" : "< 24h Optimal"}
            </span>
          </div>
          <div className="flex justify-between text-2xs">
            <span className="text-zinc-400">Downstream Impact:</span>
            <span className="text-zinc-200 font-semibold">{data.downstreamCount ?? 2} assets</span>
          </div>
          <div className="truncate border-t border-[#1a1a22] pt-1 text-[9px] text-zinc-400" title={data.urn}>
            {data.urn}
          </div>
        </div>
      )}
    </div>
  );
}
