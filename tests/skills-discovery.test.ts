import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import {
  parseFrontmatter,
  selectSkills,
  type SkillEntry,
} from "../extensions/loom/skills-discovery";
import {
  fetchSkillFile,
  githubRawBase,
  type ConfiguredSkillRepo,
} from "../extensions/loom/skills-discovery";

describe("parseFrontmatter", () => {
  it("reads name, description, when_to_use, and a surfaces list", () => {
    const text = `---
name: galaxy-mcp-reference
description: Galaxy MCP reference
when_to_use: Use for MCP calls
surfaces: [loom, claude-code]
user_invocable: true
---
body here`;
    const fm = parseFrontmatter(text);
    expect(fm.name).toBe("galaxy-mcp-reference");
    expect(fm.description).toBe("Galaxy MCP reference");
    expect(fm.when_to_use).toBe("Use for MCP calls");
    expect(fm.surfaces).toEqual(["loom", "claude-code"]);
  });

  it("normalizes a scalar surfaces value to a one-element array", () => {
    const fm = parseFrontmatter(`---\nname: x\nsurfaces: loom\n---\n`);
    expect(fm.surfaces).toEqual(["loom"]);
  });

  it("returns empty surfaces when the tag is absent", () => {
    const fm = parseFrontmatter(`---\nname: x\ndescription: y\n---\n`);
    expect(fm.surfaces).toEqual([]);
    expect(fm.when_to_use).toBeUndefined();
  });

  it("returns {} for content with no frontmatter block", () => {
    expect(parseFrontmatter("no frontmatter here")).toEqual({});
  });

  it("returns {} for malformed YAML instead of throwing", () => {
    expect(parseFrontmatter(`---\n: : :\nname: [unclosed\n---\n`)).toEqual({});
  });
});

describe("selectSkills (tag-or-all)", () => {
  const mk = (path: string, surfaces: string[]): SkillEntry => ({
    path,
    name: path,
    description: "",
    surfaces,
  });

  it("returns only loom-tagged skills when at least one is tagged", () => {
    const entries = [mk("a", ["loom"]), mk("b", []), mk("c", ["claude-code"])];
    expect(selectSkills(entries).map((e) => e.path)).toEqual(["a"]);
  });

  it("returns all skills when none are tagged", () => {
    const entries = [mk("a", []), mk("b", [])];
    expect(selectSkills(entries).map((e) => e.path)).toEqual(["a", "b"]);
  });
});

const REPO: ConfiguredSkillRepo = {
  name: "galaxy-skills",
  url: "https://github.com/galaxyproject/galaxy-skills",
  branch: "main",
};

describe("githubRawBase", () => {
  it("maps a github repo url to its raw base", () => {
    expect(githubRawBase(REPO.url, "main")).toBe(
      "https://raw.githubusercontent.com/galaxyproject/galaxy-skills/main",
    );
  });
  it("returns null for non-github urls", () => {
    expect(githubRawBase("https://example.com/x/y", "main")).toBeNull();
  });
});

describe("fetchSkillFile", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loom-skills-"));
    vi.spyOn(os, "homedir").mockReturnValue(tmp);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("fetches, writes to cache, and reports cached:false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("hello skill", { status: 200 })));
    const res = await fetchSkillFile(REPO, "collection-manipulation/SKILL.md");
    expect(res).toEqual({ ok: true, text: "hello skill", cached: false });
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();
    const res2 = await fetchSkillFile(REPO, "collection-manipulation/SKILL.md");
    expect(res2).toEqual({ ok: true, text: "hello skill", cached: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns ok:false with the status on a non-200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    const res = await fetchSkillFile(REPO, "missing/SKILL.md");
    expect(res).toEqual({ ok: false, status: 404, error: "HTTP 404" });
  });

  it("expires a SKILL.md cache entry after the 1h catalog TTL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("v1", { status: 200 })));
    await fetchSkillFile(REPO, "x/SKILL.md");
    const cacheFile = fs
      .readdirSync(path.join(tmp, ".loom", "cache", "skills"))
      .map((d) => path.join(tmp, ".loom", "cache", "skills", d, "x", "SKILL.md"))
      .find((p) => fs.existsSync(p))!;
    const old = Date.now() / 1000 - 2 * 60 * 60;
    fs.utimesSync(cacheFile, old, old);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("v2", { status: 200 }),
    );
    const res = await fetchSkillFile(REPO, "x/SKILL.md");
    expect(res).toEqual({ ok: true, text: "v2", cached: false });
  });
});
