// @vitest-environment happy-dom
//
// Stateful tests for the ChatPanel -> export `history` buffer. These drive a
// real ChatPanel against a happy-dom container (the pure historyToMarkdown /
// fragmentToMarkdown helpers are covered separately in chat-panel.test.ts).
import { beforeEach, describe, expect, it } from "vitest";
import { ChatPanel } from "../app/src/renderer/chat/chat-panel.js";
import { TEAM_DISPATCH_KIND } from "../shared/team-dispatch-contract.js";

beforeEach(() => {
  document.body.innerHTML = "";
});

function makePanel(): ChatPanel {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return new ChatPanel(container);
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("ChatPanel error history", () => {
  it("records one entry per visible card when duplicate errors collapse", () => {
    const panel = makePanel();
    // The UI collapses consecutive identical errors into one card with "(xN)";
    // the export must mirror that, not emit one block per swallowed duplicate.
    panel.addErrorMessage("boom");
    panel.addErrorMessage("boom");
    panel.addErrorMessage("boom");
    const md = panel.exportAsMarkdown();
    expect(countOccurrences(md, "*Error: boom*")).toBe(1);
  });

  it("records distinct errors separately", () => {
    const panel = makePanel();
    panel.addErrorMessage("first");
    panel.addErrorMessage("second");
    const md = panel.exportAsMarkdown();
    expect(md).toContain("*Error: first*");
    expect(md).toContain("*Error: second*");
  });
});
