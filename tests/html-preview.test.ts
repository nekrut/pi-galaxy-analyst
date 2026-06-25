// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import {
  buildHtmlPreviewDocument,
  htmlPreviewBaseHref,
} from "../app/src/renderer/files/html-preview.js";

describe("htmlPreviewBaseHref", () => {
  it("points root-level HTML at the cwd artifact root", () => {
    expect(htmlPreviewBaseHref("report.html")).toBe("orbit-artifact://cwd/");
  });

  it("points nested HTML at its containing directory", () => {
    expect(htmlPreviewBaseHref("reports/run-1/report.html")).toBe(
      "orbit-artifact://cwd/reports/run-1/",
    );
  });

  it("encodes path segments", () => {
    expect(htmlPreviewBaseHref("my reports/café run/report.html")).toBe(
      "orbit-artifact://cwd/my%20reports/caf%C3%A9%20run/",
    );
  });
});

describe("buildHtmlPreviewDocument", () => {
  it("injects a restrictive CSP and base href into an existing head", () => {
    const html = buildHtmlPreviewDocument(
      "reports/report.html",
      "<!doctype html><html><head><title>R</title></head><body><h1>Report</h1></body></html>",
    );

    expect(html).toContain('<base href="orbit-artifact://cwd/reports/">');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("script-src 'unsafe-inline' blob:");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("form-action 'none'");
    expect(html).toContain("connect-src 'none'");
    expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf("<title>R</title>"));
  });

  it("wraps an HTML fragment with a safe document shell", () => {
    const html = buildHtmlPreviewDocument("report.html", "<h1>Report</h1>");

    expect(html).toMatch(/^<!doctype html><html><head>/);
    expect(html).toContain('<base href="orbit-artifact://cwd/">');
    expect(html).toContain("<body><h1>Report</h1></body>");
  });

  it("escapes generated attributes", () => {
    const html = buildHtmlPreviewDocument('a "quoted"/report.html', "<p>x</p>");

    expect(html).toContain('href="orbit-artifact://cwd/a%20%22quoted%22/"');
    expect(html).not.toContain('href="orbit-artifact://cwd/a "quoted"/"');
  });
});
