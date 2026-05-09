import { describe, it, expect } from "vitest";
import {
  renderSessionSummaryYaml,
  appendSessionSummaryBlock,
  findSessionSummaryBlocks,
  type SessionSummaryYaml,
} from "../extensions/loom/notebook-writer";

const sample: SessionSummaryYaml = {
  id: "sess_abc123",
  startedAt: "2026-05-08T19:30:00Z",
  endedAt: "2026-05-08T20:15:42Z",
  notebook: "notebook.md",
  orphanedActiveSteps: 0,
};

describe("renderSessionSummaryYaml", () => {
  it("emits a fenced loom-session block with all required fields", () => {
    const out = renderSessionSummaryYaml(sample);
    expect(out).toContain("```loom-session");
    expect(out).toContain("id: sess_abc123");
    expect(out).toContain("started_at: 2026-05-08T19:30:00Z");
    expect(out).toContain("ended_at: 2026-05-08T20:15:42Z");
    expect(out).toContain("notebook: notebook.md");
    expect(out).toContain("orphaned_active_steps: 0");
    expect(out.endsWith("```\n")).toBe(true);
  });
});

describe("appendSessionSummaryBlock", () => {
  it("appends to a non-empty notebook with a separating blank line", () => {
    const before = "# notebook\n\nsome content here\n";
    const out = appendSessionSummaryBlock(before, sample);
    expect(out.startsWith("# notebook\n\nsome content here\n\n```loom-session\n")).toBe(true);
    expect(out.endsWith("```\n")).toBe(true);
  });

  it("appends to an empty notebook without a leading blank line", () => {
    const out = appendSessionSummaryBlock("", sample);
    expect(out.startsWith("```loom-session\n")).toBe(true);
  });

  it("preserves prior session blocks (sessions are append-only)", () => {
    const earlier: SessionSummaryYaml = {
      ...sample,
      id: "sess_earlier",
      endedAt: "2026-05-08T18:00:00Z",
    };
    const intermediate = appendSessionSummaryBlock("# notebook\n", earlier);
    const final = appendSessionSummaryBlock(intermediate, sample);
    const blocks = findSessionSummaryBlocks(final);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].id).toBe("sess_earlier");
    expect(blocks[1].id).toBe("sess_abc123");
  });
});

describe("findSessionSummaryBlocks", () => {
  it("round-trips through render -> append -> parse", () => {
    const content = appendSessionSummaryBlock("# notebook\n", sample);
    const parsed = findSessionSummaryBlocks(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(sample);
  });

  it("returns the most recent block last (chronological order)", () => {
    const a = { ...sample, id: "sess_a", endedAt: "2026-05-08T18:00:00Z" };
    const b = { ...sample, id: "sess_b", endedAt: "2026-05-08T19:00:00Z" };
    const c = { ...sample, id: "sess_c", endedAt: "2026-05-08T20:00:00Z" };
    let content = "# nb\n";
    for (const s of [a, b, c]) content = appendSessionSummaryBlock(content, s);
    const blocks = findSessionSummaryBlocks(content);
    expect(blocks.map((b) => b.id)).toEqual(["sess_a", "sess_b", "sess_c"]);
  });

  it("skips malformed blocks without throwing", () => {
    const content = `# nb

\`\`\`loom-session
id: only_id
\`\`\`

\`\`\`loom-session
id: complete
started_at: 2026-05-08T19:30:00Z
ended_at: 2026-05-08T20:00:00Z
notebook: notebook.md
orphaned_active_steps: 0
\`\`\`
`;
    const blocks = findSessionSummaryBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe("complete");
  });

  it("returns empty array when no blocks present", () => {
    expect(findSessionSummaryBlocks("# just notebook content\n\nNo blocks.")).toEqual([]);
  });

  it("defaults orphanedActiveSteps to 0 when the field is non-numeric", () => {
    const content = `\`\`\`loom-session
id: weird
started_at: 2026-05-08T19:30:00Z
ended_at: 2026-05-08T20:00:00Z
notebook: notebook.md
orphaned_active_steps: not-a-number
\`\`\`
`;
    const blocks = findSessionSummaryBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].orphanedActiveSteps).toBe(0);
  });
});
