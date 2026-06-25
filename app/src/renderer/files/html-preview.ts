import { previewImageBaseDir } from "./markdown-preview.js";

const HTML_PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri orbit-artifact:",
  "img-src orbit-artifact: data: blob:",
  "style-src orbit-artifact: 'unsafe-inline'",
  "font-src orbit-artifact: data:",
  "media-src orbit-artifact: data: blob:",
].join("; ");

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function encodeArtifactPath(p: string): string {
  if (!p) return "";
  return p.split("/").map(encodeURIComponent).join("/") + "/";
}

export function htmlPreviewBaseHref(relPath: string): string {
  return `orbit-artifact://cwd/${encodeArtifactPath(previewImageBaseDir(relPath))}`;
}

export function buildHtmlPreviewDocument(relPath: string, html: string): string {
  const tags = [
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(HTML_PREVIEW_CSP)}">`,
    `<base href="${escapeAttr(htmlPreviewBaseHref(relPath))}">`,
  ].join("");

  if (/<head(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(?:\s[^>]*)?>/i, (m) => `${m}${tags}`);
  }

  return `<!doctype html><html><head>${tags}</head><body>${html}</body></html>`;
}
