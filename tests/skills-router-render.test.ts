import { describe, it, expect } from "vitest";
import { renderSkillsSection } from "../extensions/loom/context";
import type { SkillEntry } from "../extensions/loom/skills-discovery";

const repos = [
  { name: "galaxy-skills", url: "https://github.com/galaxyproject/galaxy-skills", branch: "main" },
];

describe("renderSkillsSection", () => {
  it("renders one router line per entry with the fetch path", () => {
    const entries: SkillEntry[] = [
      {
        path: "collection-manipulation/SKILL.md",
        name: "galaxy-transform-collection",
        description: "transform collections",
        surfaces: ["loom"],
      },
    ];
    const out = renderSkillsSection(repos, new Map([["galaxy-skills", entries]]));
    expect(out).toContain("galaxy-transform-collection");
    expect(out).toContain('path: "collection-manipulation/SKILL.md"');
    expect(out).toContain("## Skills repositories");
  });

  it("includes when_to_use as a sub-line only when present", () => {
    const entries: SkillEntry[] = [
      {
        path: "galaxy-integration/mcp-reference/SKILL.md",
        name: "galaxy-mcp-reference",
        description: "mcp ref",
        when_to_use: "Use for MCP calls",
        surfaces: ["loom"],
      },
    ];
    const out = renderSkillsSection(repos, new Map([["galaxy-skills", entries]]));
    expect(out).toContain("When to use: Use for MCP calls");
  });

  it("returns empty string when there are no repos", () => {
    expect(renderSkillsSection([], new Map())).toBe("");
  });
});
