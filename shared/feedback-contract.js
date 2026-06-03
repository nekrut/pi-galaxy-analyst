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
export const FEEDBACK_ENDPOINT_URL = "https://orbit-feedback.dannon-baker.workers.dev";

const SOURCES = new Set(["orbit", "loom-cli"]);

export function validateFeedbackPayload(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj;
  if (p.schemaVersion !== SCHEMA_VERSION) return false;
  if (typeof p.source !== "string" || !SOURCES.has(p.source)) return false;
  if (typeof p.title !== "string" || p.title.trim().length === 0) return false;
  if (typeof p.body !== "string") return false;
  if (typeof p.clientTs !== "string") return false;
  // testerId is optional; when present it must be a string (opaque tester code).
  if (p.testerId !== undefined && typeof p.testerId !== "string") return false;
  return true;
}

const ACTIVITY_TAIL_MAX_BYTES = 64 * 1024;
// Per-field character limits (not bytes) for readability; the wire byte budget
// is enforced separately by trimLinesToBytes.
const ARGS_MAX = 200;
const RESULT_MAX = 500;
const PROMPT_MAX = 200;

const textEncoder = new TextEncoder();

function byteLen(s) {
  return textEncoder.encode(s).length;
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function compactArgs(args) {
  if (args == null) return "";
  let s;
  try {
    s = JSON.stringify(args);
  } catch {
    s = String(args);
  }
  return s ? "args=" + truncate(s, ARGS_MAX) : "";
}

// One line per event. Renders the already-redacted/truncated payload fields the
// upstream activity hooks produced -- this function adds no redaction of its own.
function formatActivityEvent(e) {
  const ts = e && e.timestamp ? e.timestamp : "?";
  const p = (e && e.payload) || {};
  switch (e && e.kind) {
    case "user.prompt":
      return `${ts} user.prompt ${truncate(String(p.text ?? ""), PROMPT_MAX)}`.trimEnd();
    case "tool.start":
      return `${ts} tool.start ${p.toolName ?? "?"} ${compactArgs(p.args)}`.trimEnd();
    case "tool.end": {
      const flag = p.isError ? "✗" : "✓";
      return `${ts} tool.end ${p.toolName ?? "?"} ${flag} ${truncate(String(p.resultSummary ?? ""), RESULT_MAX)}`.trimEnd();
    }
    default:
      return `${ts} ${(e && e.kind) ?? "?"}${e && e.source ? " (" + e.source + ")" : ""}`;
  }
}

// Drop oldest (leading) lines until the text fits maxBytes; hard-slice a lone
// over-budget line as a floor.
function trimLinesToBytes(text, maxBytes) {
  if (byteLen(text) <= maxBytes) return text;
  const lines = text.split("\n");
  while (lines.length > 1 && byteLen(lines.join("\n")) > maxBytes) {
    lines.shift();
  }
  let out = lines.join("\n");
  if (byteLen(out) > maxBytes) {
    // Floor for a lone over-budget line: accumulate whole codepoints up to the
    // budget so we never split a multibyte char or overshoot maxBytes.
    let acc = "";
    for (const ch of out) {
      if (byteLen(acc + ch) > maxBytes) break;
      acc += ch;
    }
    out = acc;
  }
  return out;
}

export function formatActivityTail(events, opts = {}) {
  const maxBytes = opts.maxBytes ?? ACTIVITY_TAIL_MAX_BYTES;
  const text = (events || []).map(formatActivityEvent).join("\n");
  return trimLinesToBytes(text, maxBytes);
}
