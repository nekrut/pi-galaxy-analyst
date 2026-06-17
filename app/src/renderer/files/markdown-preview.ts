/**
 * Markdown-preview helpers for the File pane (#283).
 *
 * The File pane's Preview renders agent/report-authored markdown that often
 * embeds local images via relative paths (`![plot](plot.svg)`). Rendered with
 * the default `marked`, those `<img src="plot.svg">` resolve against the
 * renderer document's base URL (the app's index.html), not the markdown file's
 * directory, so valid reports show broken images.
 *
 * The notebook pane already solved the same class of problem by rewriting
 * relative srcs to the cwd-jailed `orbit-artifact://` scheme served by the main
 * process (see `artifacts/artifact-panel.ts` + the `protocol.handle` in
 * `main/main.ts`). The File pane reuses that exact scheme — no new file-access
 * surface — with one difference: a File-pane markdown file can live in a
 * subdirectory of the cwd, so a relative ref must resolve against the file's
 * directory, not the cwd root.
 *
 * These helpers are kept DOM-free (the `marked` import is pure JS) so they can
 * be unit-tested in a plain Node/happy-dom environment, mirroring
 * `image-preview.ts`.
 */

import { Marked } from "marked";

// Leading scheme (`https:`, `data:`, `orbit-artifact:`) or protocol-relative
// `//`. Matches the notebook pane's guard (artifact-panel.ts) on purpose so both
// panes treat the same hrefs as absolute. Known limitation kept for that
// consistency: a relative filename that contains a colon (`a:b.png`, legal on
// POSIX) reads as a scheme and stays unrewritten — author can prefix `./`.
const ABSOLUTE_OR_SCHEME = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * POSIX dirname of a cwd-relative path (paths from `files:list` always use
 * forward slashes). `reports/summary.md` → `reports`; `summary.md` → ``.
 */
export function previewImageBaseDir(relPath: string): string {
  const slash = relPath.lastIndexOf("/");
  return slash < 0 ? "" : relPath.slice(0, slash);
}

/** Collapse `.`/`..` segments in a POSIX path, preserving any leading `..`. */
function normalizePosix(p: string): string {
  const out: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (out.length && out[out.length - 1] !== "..") out.pop();
      else out.push("..");
    } else {
      out.push(seg);
    }
  }
  return out.join("/");
}

/**
 * Rewrite a relative image href to the cwd-jailed `orbit-artifact://` scheme,
 * resolved against `baseDir` (the markdown file's directory, relative to cwd).
 * Absolute URLs, other schemes, and protocol-relative URLs pass through
 * untouched. A leading-slash href is treated as cwd-root relative (baseDir
 * ignored), matching the notebook pane's convention.
 *
 * The `orbit-artifact` protocol handler re-resolves the path against the live
 * cwd and refuses (via realpath) anything that escapes it through `..`/symlinks
 * — that is the security boundary. Here we additionally:
 *   - fail closed on a ref that climbs above the cwd root: return an empty src
 *     (the caller then emits no `src`) instead of echoing the raw href, which
 *     the renderer would otherwise resolve against its own base URL rather than
 *     the cwd jail;
 *   - percent-encode each path segment, so reserved URL characters (`#`, `?`,
 *     `%`, space) and pre-encoded traversal (`%2e%2e`) round-trip as literal
 *     filenames through the handler's `decodeURIComponent` rather than break or
 *     re-fold into `..`.
 *
 * Returns "" for any ref that can't be safely jailed; callers must treat an
 * empty result as "no usable src" and emit no `src` attribute.
 */
export function rewritePreviewImageHref(baseDir: string, href: string): string {
  if (ABSOLUTE_OR_SCHEME.test(href)) return href;
  // A leading `\\` (UNC, e.g. \\server\share) is not a cwd-relative ref. After
  // backslash normalization below it would masquerade as one and could resolve
  // to a same-named file under cwd, so fail closed up front.
  if (/^\\\\/.test(href)) return "";
  // Windows-authored reports may use backslash separators; the cwd jail and the
  // orbit-artifact handler speak forward slashes.
  const ref = href.replace(/\\/g, "/");
  const rooted = ref.startsWith("/");
  const joined = rooted || !baseDir ? ref.replace(/^\/+/, "") : `${baseDir}/${ref}`;
  const normalized = normalizePosix(joined);
  // Climbs above the cwd root can't be jailed -- fail closed rather than echo
  // the raw href back into the renderer (where it would resolve against the
  // app's base URL, not the cwd jail).
  if (normalized === "" || normalized === ".." || normalized.startsWith("../")) {
    return "";
  }
  const encoded = normalized.split("/").map(encodeURIComponent).join("/");
  return `orbit-artifact://cwd/${encoded}`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * A `Marked` instance whose image renderer resolves relative srcs against
 * `baseDir`. Only images are overridden — links keep marked's default
 * rendering so click/navigation behavior is unchanged. Pass the result as the
 * second arg to `renderMarkdown(...)` so the shared sanitizer still runs.
 */
export function buildPreviewMarked(baseDir: string): Marked {
  return new Marked({
    renderer: {
      image({ href, title, text }) {
        const rewritten = rewritePreviewImageHref(baseDir, href ?? "");
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
        // An empty rewrite means "couldn't be jailed" -- emit no src so the
        // image fails closed (broken image) rather than carrying a raw href.
        const srcAttr = rewritten ? ` src="${escapeAttr(rewritten)}"` : "";
        return `<img${srcAttr} alt="${escapeAttr(text ?? "")}"${titleAttr}>`;
      },
    },
  });
}
