// Shared feedback wire contract. Dual-file (.js runtime + .d.ts types) to match
// team-dispatch-contract: the brain resolves a real .js at runtime, so a single
// .ts would risk a missing runtime file. No Node imports here -- this file is
// renderer-safe and shared by the brain, Orbit main, and (by copy) the worker.

export const SCHEMA_VERSION = 1;
export const FEEDBACK_ROUTE = "/feedback";
export const FEEDBACK_KEY_HEADER = "X-Orbit-Feedback-Key";

// Production endpoint base (no trailing slash). Set after `wrangler deploy` of
// the orbit-feedback worker. Clients may override via the LOOM_FEEDBACK_URL env
// var for local dev.
export const FEEDBACK_ENDPOINT_URL = "https://orbit-feedback.PLACEHOLDER.workers.dev";

const SOURCES = new Set(["orbit", "loom-cli"]);

export function validateFeedbackPayload(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj;
  if (p.schemaVersion !== SCHEMA_VERSION) return false;
  if (typeof p.source !== "string" || !SOURCES.has(p.source)) return false;
  if (typeof p.title !== "string" || p.title.trim().length === 0) return false;
  if (typeof p.body !== "string") return false;
  if (typeof p.clientTs !== "string") return false;
  return true;
}
