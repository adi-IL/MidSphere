import type { GateDecision, JobArtifact } from "./types";
import { DEMO_JOB } from "./demoJob";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function tryJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchHealth(): Promise<{
  status: string;
  datahub?: string;
  mode?: string;
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
  try {
    const res = await fetch(`${API_BASE}/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as JobArtifact;
  } catch {
    return null;
  }
}

export async function fetchGate(urn: string): Promise<GateDecision | null> {
  return tryJson(`/v1/gate/${encodeURIComponent(urn)}`);
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
