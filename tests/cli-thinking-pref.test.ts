import { describe, it, expect } from "vitest";
import { resolveHideThinking, isInteractiveTerminal } from "../bin/thinking-pref.js";

describe("resolveHideThinking", () => {
  it("hides thinking by default (no config)", () => {
    expect(resolveHideThinking()).toBe(true);
    expect(resolveHideThinking({})).toBe(true);
    expect(resolveHideThinking({ configShowThinking: undefined })).toBe(true);
  });

  it("shows thinking when ui.showThinking is true", () => {
    expect(resolveHideThinking({ configShowThinking: true })).toBe(false);
  });

  it("stays hidden when ui.showThinking is explicitly false", () => {
    expect(resolveHideThinking({ configShowThinking: false })).toBe(true);
  });

  it("only literal true opts in (not other truthy values)", () => {
    // Guards against a stray non-boolean in config flipping the default.
    expect(resolveHideThinking({ configShowThinking: 1 })).toBe(true);
    expect(resolveHideThinking({ configShowThinking: "true" })).toBe(true);
  });
});

describe("isInteractiveTerminal", () => {
  it("treats a plain terminal launch (no args / text mode) as interactive", () => {
    expect(isInteractiveTerminal([])).toBe(true);
    expect(isInteractiveTerminal(["--continue"])).toBe(true);
    expect(isInteractiveTerminal(["--mode", "text"])).toBe(true);
  });

  it("excludes rpc and json modes (Orbit, web server, evals)", () => {
    expect(isInteractiveTerminal(["--mode", "rpc"])).toBe(false);
    expect(isInteractiveTerminal(["--mode", "json"])).toBe(false);
    expect(isInteractiveTerminal(["--mode=rpc"])).toBe(false);
  });

  it("excludes headless --print / -p", () => {
    expect(isInteractiveTerminal(["--print", "hi"])).toBe(false);
    expect(isInteractiveTerminal(["-p", "hi"])).toBe(false);
  });
});
