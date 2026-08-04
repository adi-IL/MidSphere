export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AgentName =
  | "ContextSentinel"
  | "CascadeAnalyzer"
  | "CircuitBreaker"
  | "FixArchitect"
  | "MBOMEngine";
export type AgentStatus = "IDLE" | "RUNNING" | "WAITING_TOOL" | "DONE" | "ERROR";
export type GateStatus = "OPEN" | "BLOCKED" | "LIFTED";

export interface AuditFinding {
  id: string;
  type: string;
  severity: Severity;
  entity_urn: string;
  column_path?: string | null;
  evidence: string;
  rationale: string;
}

export interface BlastNode {
  urn: string;
  name: string;
  hop: number;
  impacted: boolean;
  reason?: string;
}

export interface QuarantineReceipt {
  entityUrns: string[];
  tagsApplied: string[];
  properties: Record<string, string>;
  incidentUrn?: string;
  gateStatus: GateStatus;
}

export interface JobEvent {
  ts: string;
  agent: AgentName | string;
  kind: "TOOL" | "FIND" | "SCORE" | "WRITE" | "PR" | "MBOM" | "ERROR" | "STATUS";
  message: string;
  payload?: unknown;
}

export interface JobArtifact {
  job_id: string;
  root_urn: string;
  mode: string;
  status: string;
  findings: AuditFinding[];
  blast_radius: { risk_score: number; nodes: BlastNode[]; selective?: boolean };
  quarantine: QuarantineReceipt | null;
  pr: { status: string; path?: string; url?: string; diff_summary?: string } | null;
  mbom: { path?: string; document_urn?: string; related_assets?: string[] } | null;
  events: JobEvent[];
  execution_mode?: "demo_closed_loop" | "live_mcp" | "antigravity_closed_loop";
  mutations_applied?: boolean;
  datahub_reachable?: boolean;
  gate_policy?: string;
}

export interface GateDecision {
  urn: string;
  status: GateStatus;
  reason: string;
  job_id?: string | null;
  pr_url?: string | null;
  mbom_urn?: string | null;
  risk_score?: number | null;
  policy?: string | null;
}

// Monochrome-first agent accents (subtle, not rainbow chrome)
export const AGENT_ACCENTS: Record<AgentName, string> = {
  ContextSentinel: "#0070f3",
  CascadeAnalyzer: "#888888",
  CircuitBreaker: "#ff4d4f",
  FixArchitect: "#00c853",
  MBOMEngine: "#f5a623",
};

export const DEFAULT_ROOT_URN =
  "urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)";
