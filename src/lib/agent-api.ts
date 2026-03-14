/**
 * Agent API client.
 * Connects to the Python monitoring agent for real ping/traceroute data.
 * Configure the agent URL via VITE_AGENT_URL environment variable.
 * Falls back to simulated data when the agent is unreachable.
 */

import { Target, TimelinePoint, HopData, generateInitialTimeline, generateTimelinePoint, getHopsForTarget, TARGETS as DEFAULT_TARGETS } from "./network-data";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:5000";

let agentAvailable: boolean | null = null;

export async function checkAgentHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    agentAvailable = res.ok;
  } catch {
    agentAvailable = false;
  }
  return agentAvailable;
}

export function isAgentAvailable(): boolean | null {
  return agentAvailable;
}

export async function fetchTargets(): Promise<Target[]> {
  if (agentAvailable === false) return DEFAULT_TARGETS;
  try {
    const res = await fetch(`${AGENT_URL}/api/targets`);
    if (!res.ok) throw new Error("Failed");
    const data = await res.json();
    return data.map((t: any) => ({
      id: t.id,
      label: t.label,
      host: t.host,
      status: t.status || "good",
    }));
  } catch {
    agentAvailable = false;
    return DEFAULT_TARGETS;
  }
}

export async function fetchTimeline(targetId: string): Promise<TimelinePoint[]> {
  if (agentAvailable === false) return generateInitialTimeline(targetId);
  try {
    const res = await fetch(`${AGENT_URL}/api/timeline/${targetId}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    return generateInitialTimeline(targetId);
  }
}

export async function fetchHops(targetId: string): Promise<HopData[]> {
  if (agentAvailable === false) return getHopsForTarget(targetId);
  try {
    const res = await fetch(`${AGENT_URL}/api/hops/${targetId}`);
    if (!res.ok) throw new Error("Failed");
    const data = await res.json();
    return data.length > 0 ? data : getHopsForTarget(targetId);
  } catch {
    return getHopsForTarget(targetId);
  }
}

export async function addTarget(host: string, label?: string): Promise<Target | null> {
  if (agentAvailable === false) return null;
  try {
    const res = await fetch(`${AGENT_URL}/api/targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, label: label || host }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deleteTarget(targetId: string): Promise<boolean> {
  if (agentAvailable === false) return false;
  try {
    const res = await fetch(`${AGENT_URL}/api/targets/${targetId}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
