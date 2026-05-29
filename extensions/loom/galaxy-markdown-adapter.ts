/**
 * Loom <-> Galaxy-flavored-markdown content adapter. notebook.md is canonical.
 *
 * Push replaces each `loom-invocation` fenced block with a hidden HTML-comment
 * carrier holding the literal block, base64-encoded. Galaxy preserves both the
 * markdown body and HTML comments byte-for-byte (verified against 26.1.rc1), so
 * pull restores the original fences exactly. base64 keeps the payload free of
 * `-->` and newlines, so the comment is always single-line and well-formed.
 *
 * Phase 2 adds a visible ` ```galaxy ` directive alongside the carrier; pull
 * strips those directives (Loom owns the projection under the loom-canonical
 * model), which is why galaxyMarkdownToLoom removes ```galaxy blocks here even
 * though Phase 1 never emits them -- it keeps pull forward-compatible.
 */

import { galaxyGet } from "./galaxy-api";

const INV_FENCE_OPEN = "```loom-invocation";
const FENCE_CLOSE = "```";
const GALAXY_FENCE_OPEN = "```galaxy";

const CARRIER_RE = /<!-- loom-invocation:v1 ([A-Za-z0-9+/=]+) -->/g;

/** Push: loom-invocation fences -> hidden base64 carriers. Narrative untouched. */
export function loomToGalaxyMarkdown(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === INV_FENCE_OPEN) {
      let end = i + 1;
      while (end < lines.length && lines[end].trim() !== FENCE_CLOSE) end++;
      const block = lines.slice(i, end + 1).join("\n");
      const b64 = Buffer.from(block, "utf8").toString("base64");
      out.push(`<!-- loom-invocation:v1 ${b64} -->`);
      i = end + 1;
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join("\n");
}

/** Pull: carriers -> original loom-invocation fences; strip any ```galaxy blocks. */
export function galaxyMarkdownToLoom(body: string): string {
  const restored = body.replace(CARRIER_RE, (_m, b64: string) =>
    Buffer.from(b64, "base64").toString("utf8"),
  );
  return stripGalaxyDirectiveBlocks(restored);
}

/** Remove ```galaxy ... ``` fenced blocks (Loom-emitted projection, regenerated each push). */
function stripGalaxyDirectiveBlocks(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === GALAXY_FENCE_OPEN) {
      let end = i + 1;
      while (end < lines.length && lines[end].trim() !== FENCE_CLOSE) end++;
      i = end + 1;
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join("\n");
}

/** Decides whether an invocation id is renderable on the connected server. */
export interface InvocationValidator {
  isValid(invocationId: string): Promise<boolean>;
}

/**
 * Real validator: a GET that resolves means the id decodes and exists. It
 * queries the ambient configured server (galaxyGet reads GALAXY_URL), not a
 * block's own galaxy_server_url -- so an id from a different server validates
 * as false and its directive is safely omitted, which is correct under the
 * single-server push model.
 */
export const galaxyInvocationValidator: InvocationValidator = {
  async isValid(invocationId: string): Promise<boolean> {
    try {
      await galaxyGet(`/invocations/${invocationId}`);
      return true;
    } catch {
      return false;
    }
  },
};

const INV_ID_RE = /^invocation_id:\s*(.+)$/;

/**
 * Push with rich rendering: each loom-invocation block becomes a hidden carrier
 * AND, when its id validates, a visible `invocation_outputs` directive. The
 * directive is gated because Galaxy 400s the whole page on an undecodable id.
 */
export async function loomToGalaxyMarkdownRich(
  body: string,
  validator: InvocationValidator,
): Promise<string> {
  const lines = body.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === INV_FENCE_OPEN) {
      let end = i + 1;
      let invId: string | null = null;
      while (end < lines.length && lines[end].trim() !== FENCE_CLOSE) {
        const m = lines[end].match(INV_ID_RE);
        if (m) invId = m[1].trim();
        end++;
      }
      const block = lines.slice(i, end + 1).join("\n");
      const carrier = `<!-- loom-invocation:v1 ${Buffer.from(block, "utf8").toString("base64")} -->`;
      // Emit the directive immediately before the carrier with NO extra blank
      // line, so stripping the 3 fence lines on pull restores the carrier in
      // the block's exact original position -- keeping the round trip identical.
      if (invId && (await validator.isValid(invId))) {
        out.push(GALAXY_FENCE_OPEN);
        out.push(`invocation_outputs(invocation_id=${invId})`);
        out.push(FENCE_CLOSE);
      }
      out.push(carrier);
      i = end + 1;
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join("\n");
}
