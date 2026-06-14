// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  buildHistoryUrl,
  parseGalaxyHistoryBindings,
  refreshGalaxyHistory,
} from "../app/src/renderer/galaxy-history";

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

describe("refreshGalaxyHistory", () => {
  const NOTEBOOK_WITH_BINDING = [
    "# Notebook",
    "",
    "```loom-galaxy-page",
    "page_id: page123",
    "history_id: hist456",
    "```",
    "",
  ].join("\n");

  function setupDom(): { section: HTMLElement; body: HTMLElement } {
    document.body.innerHTML = `
      <div id="activity-galaxy-history-section" class="hidden">
        <div id="galaxy-history-body"></div>
      </div>
    `;
    return {
      section: document.getElementById("activity-galaxy-history-section")!,
      body: document.getElementById("galaxy-history-body")!,
    };
  }

  function api(opts: {
    status: { connected: boolean; url: string | null };
    notebook?: string;
    onOpen?: (url: string) => void;
  }): Parameters<typeof refreshGalaxyHistory>[0] {
    return {
      getGalaxyStatus: async () => opts.status,
      readFile: async () =>
        opts.notebook !== undefined
          ? { ok: true as const, bytes: new TextEncoder().encode(opts.notebook) }
          : { ok: false as const },
      openGalaxyHistory: async (url: string) => {
        opts.onOpen?.(url);
        return { opened: true };
      },
    };
  }

  it("shows the section and builds the view URL from the effective env URL when connected (#290)", async () => {
    // Env-driven session: no saved profile, status reports connected with the
    // exported GALAXY_URL. Used to hide because it read the (empty) profile.
    const { section, body } = setupDom();
    await refreshGalaxyHistory(
      api({
        status: { connected: true, url: "https://env.example" },
        notebook: NOTEBOOK_WITH_BINDING,
      }),
    );
    expect(section.classList.contains("hidden")).toBe(false);
    const link = body.querySelector<HTMLAnchorElement>("a.galaxy-history-link");
    expect(link?.getAttribute("href")).toBe("https://env.example/histories/view?id=hist456");
  });

  it("routes a click through the host-pinned IPC path with the built URL", async () => {
    const { body } = setupDom();
    let opened: string | null = null;
    await refreshGalaxyHistory(
      api({
        status: { connected: true, url: "https://env.example" },
        notebook: NOTEBOOK_WITH_BINDING,
        onOpen: (url) => {
          opened = url;
        },
      }),
    );
    body.querySelector<HTMLAnchorElement>("a.galaxy-history-link")!.click();
    expect(opened).toBe("https://env.example/histories/view?id=hist456");
  });

  it("still works for a saved-profile URL (no regression)", async () => {
    const { section, body } = setupDom();
    await refreshGalaxyHistory(
      api({
        status: { connected: true, url: "https://main.example" },
        notebook: NOTEBOOK_WITH_BINDING,
      }),
    );
    expect(section.classList.contains("hidden")).toBe(false);
    expect(
      body.querySelector<HTMLAnchorElement>("a.galaxy-history-link")?.getAttribute("href"),
    ).toBe("https://main.example/histories/view?id=hist456");
  });

  it("hides the section when not connected", async () => {
    const { section, body } = setupDom();
    await refreshGalaxyHistory(
      api({ status: { connected: false, url: null }, notebook: NOTEBOOK_WITH_BINDING }),
    );
    expect(section.classList.contains("hidden")).toBe(true);
    expect(body.children.length).toBe(0);
  });

  it("hides even if a URL is present but the effective status is disconnected", async () => {
    // Match the footer dot exactly: gate on `connected`, not URL presence.
    const { section } = setupDom();
    await refreshGalaxyHistory(
      api({
        status: { connected: false, url: "https://env.example" },
        notebook: NOTEBOOK_WITH_BINDING,
      }),
    );
    expect(section.classList.contains("hidden")).toBe(true);
  });

  it("hides when connected but the notebook has no binding", async () => {
    const { section } = setupDom();
    await refreshGalaxyHistory(
      api({
        status: { connected: true, url: "https://env.example" },
        notebook: "# Notebook\n\njust prose\n",
      }),
    );
    expect(section.classList.contains("hidden")).toBe(true);
  });

  it("hides when the status lookup throws", async () => {
    const { section } = setupDom();
    await refreshGalaxyHistory({
      getGalaxyStatus: async () => {
        throw new Error("ipc down");
      },
      readFile: async () => ({
        ok: true as const,
        bytes: new TextEncoder().encode(NOTEBOOK_WITH_BINDING),
      }),
      openGalaxyHistory: async () => ({ opened: true }),
    });
    expect(section.classList.contains("hidden")).toBe(true);
  });
});
