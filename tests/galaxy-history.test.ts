import { describe, it, expect } from "vitest";
import { buildHistoryUrl, parseGalaxyHistoryBindings } from "../app/src/renderer/galaxy-history";

describe("buildHistoryUrl", () => {
  it("builds the canonical view URL for a root-path server", () => {
    expect(buildHistoryUrl("https://usegalaxy.org", "abc123")).toBe(
      "https://usegalaxy.org/histories/view?id=abc123",
    );
  });

  it("preserves a subpath prefix instead of resolving against the origin", () => {
    // Regression: new URL("/histories/view", base) would drop "/galaxy".
    expect(buildHistoryUrl("https://example.org/galaxy", "h1")).toBe(
      "https://example.org/galaxy/histories/view?id=h1",
    );
  });

  it("strips trailing slashes on the server URL", () => {
    expect(buildHistoryUrl("https://example.org/galaxy/", "h1")).toBe(
      "https://example.org/galaxy/histories/view?id=h1",
    );
    expect(buildHistoryUrl("https://usegalaxy.org///", "h1")).toBe(
      "https://usegalaxy.org/histories/view?id=h1",
    );
  });

  it("URL-encodes the history id query param", () => {
    expect(buildHistoryUrl("https://usegalaxy.org", "a b&c")).toBe(
      "https://usegalaxy.org/histories/view?id=a+b%26c",
    );
  });

  it("returns null for an unparseable server URL", () => {
    expect(buildHistoryUrl("not a url", "h1")).toBeNull();
    expect(buildHistoryUrl("", "h1")).toBeNull();
  });
});

describe("parseGalaxyHistoryBindings", () => {
  it("parses the history id from a well-formed block", () => {
    const md = [
      "# Notebook",
      "",
      "```loom-galaxy-page",
      "page_id: page123",
      'galaxy_server_url: "https://usegalaxy.org"',
      "history_id: hist456",
      "bound_at: 2026-01-01T00:00:00Z",
      "```",
      "",
    ].join("\n");
    expect(parseGalaxyHistoryBindings(md)).toEqual([{ historyId: "hist456" }]);
  });

  it("returns no bindings when the block lacks a history_id", () => {
    const md = [
      "```loom-galaxy-page",
      "page_id: page123",
      'galaxy_server_url: "https://usegalaxy.org"',
      "```",
    ].join("\n");
    expect(parseGalaxyHistoryBindings(md)).toEqual([]);
  });

  it("ignores other fenced blocks", () => {
    const md = [
      "```loom-invocation",
      "history_id: not_this_one",
      "```",
      "```python",
      "history_id = 'nope'",
      "```",
    ].join("\n");
    expect(parseGalaxyHistoryBindings(md)).toEqual([]);
  });

  it("returns an empty array for content with no blocks", () => {
    expect(parseGalaxyHistoryBindings("just some prose")).toEqual([]);
    expect(parseGalaxyHistoryBindings("")).toEqual([]);
  });

  it("parses multiple blocks in document order", () => {
    const md = [
      "```loom-galaxy-page",
      "history_id: first",
      "```",
      "text",
      "```loom-galaxy-page",
      "history_id: second",
      "```",
    ].join("\n");
    expect(parseGalaxyHistoryBindings(md)).toEqual([
      { historyId: "first" },
      { historyId: "second" },
    ]);
  });
});
