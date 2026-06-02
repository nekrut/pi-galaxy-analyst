import {
  FEEDBACK_ROUTE,
  FEEDBACK_ENDPOINT_URL,
  FEEDBACK_KEY_HEADER,
  SCHEMA_VERSION,
} from "../../shared/feedback-contract.js";
import type { FeedbackPayload, FeedbackSysinfo } from "../../shared/feedback-contract.js";
import type { ActivityEvent } from "./activity.js";
import { loadConfig } from "./config.js";
import { loadProfiles } from "./profiles.js";

// Endpoint base is the shared constant; LOOM_FEEDBACK_URL overrides it for local
// dev (point at http://localhost:8787 while running `wrangler dev`).
const ENDPOINT = (process.env.LOOM_FEEDBACK_URL || FEEDBACK_ENDPOINT_URL) + FEEDBACK_ROUTE;

export interface FeedbackResult {
  ok: boolean;
  status?: number;
  id?: string;
  error?: string;
}

/**
 * Summarize an activity tail to `timestamp kind (source)` lines only. Never ship
 * raw event payloads -- they carry tool I/O (paths, prompts, dataset names).
 */
export function summarizeActivityTail(events: ActivityEvent[]): string {
  return events
    .map((e) => `${e.timestamp} ${e.kind}${e.source ? " (" + e.source + ")" : ""}`)
    .join("\n");
}

/** Brain-side sysinfo. No Electron here (the brain is a Node child), no secrets. */
export function buildBrainSysinfo(): FeedbackSysinfo {
  const cfg = loadConfig() as {
    llm?: { active?: string; providers?: Record<string, { model?: string }> };
  };
  const active = cfg.llm?.active;
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    llmProvider: active,
    llmModel: active ? cfg.llm?.providers?.[active]?.model : undefined,
    galaxyConfigured: Boolean(loadProfiles().active),
  };
}

export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.LOOM_FEEDBACK_KEY) headers[FEEDBACK_KEY_HEADER] = process.env.LOOM_FEEDBACK_KEY;
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    return { ok: res.ok, status: res.status, id: data.id, error: data.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const FEEDBACK_SCHEMA_VERSION = SCHEMA_VERSION;
