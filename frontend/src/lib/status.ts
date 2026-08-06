/** Unified connection / catalog / run vocabulary (no emoji, product tone). */

export type ConnectionState = "live" | "offline" | "checking";
export type CatalogState = "on" | "off" | "unknown";
export type RunKind = "Sample" | "Agent" | "Live MCP" | "Job";

export function runKindFromMode(mode?: string, source?: "api" | "demo"): RunKind {
  if (source === "demo") return "Sample";
  if (mode === "live_mcp") return "Live MCP";
  if (mode === "antigravity_closed_loop") return "Agent";
  if (mode === "demo_closed_loop") return "Sample";
  return "Job";
}

export function runKindTone(kind: RunKind): string {
  if (kind === "Live MCP") return "text-good border-good/30";
  if (kind === "Sample") return "text-mute border-line2";
  if (kind === "Agent") return "text-ink border-line2";
  return "text-mute border-line2";
}
