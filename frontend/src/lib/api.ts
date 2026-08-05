import type { GateDecision, JobArtifact } from "./types";
import { DEMO_JOB } from "./demoJob";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

/** Avoid infinite "Loading MidSphere…" on hung Cloud Run cold starts. */
const DEFAULT_TIMEOUT_MS = 12_000;

async function tryJson<T>(
  path: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T | null> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

export async function fetchHealth(): Promise<{
  status: string;
  datahub?: string;
  mode?: string;
  datahub_reachable?: boolean;
  tier?: string;
  storage?: string;
} | null> {
  return tryJson("/v1/health");
}

export async function fetchJob(id: string): Promise<JobArtifact | null> {
  return tryJson(`/v1/jobs/${id}`);
}

export async function createJob(body: {
  root_urn: string;
  mode?: string;
  auto_trip?: boolean;
}): Promise<JobArtifact | null> {
  // Closed-loop Antigravity jobs can take 30–90s
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 120_000);
  try {
    const res = await fetch(`${API_BASE}/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as JobArtifact;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

export async function fetchGate(urn: string): Promise<GateDecision | null> {
  return tryJson(`/v1/gate/${encodeURIComponent(urn)}`);
}

export async function liftQuarantineJob(jobId: string): Promise<JobArtifact | null> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${API_BASE}/v1/jobs/${jobId}/lift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as JobArtifact;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

export async function tripJob(jobId: string): Promise<JobArtifact | null> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${API_BASE}/v1/jobs/${jobId}/trip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as JobArtifact;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

/** Prefer live API; fall back to offline demo artifact for judges. */
export async function loadCommandJob(): Promise<{
  job: JobArtifact;
  source: "api" | "demo";
}> {
  const live = await tryJson<JobArtifact>("/v1/jobs/latest");
  if (live?.job_id) return { job: live, source: "api" };
  return { job: DEMO_JOB, source: "demo" };
}
