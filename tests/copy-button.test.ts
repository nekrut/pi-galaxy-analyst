import { describe, expect, it } from "vitest";
import {
  computeCopyButtonPlacement,
  type CopyButtonInput,
} from "../app/src/renderer/chat/copy-button.js";

const VIEWPORT = { width: 1000, height: 800 };

function input(overrides: Partial<CopyButtonInput> = {}): CopyButtonInput {
  return {
    isCollapsed: false,
    rangeCount: 1,
    inContainer: true,
    rect: { top: 100, bottom: 120, right: 300, width: 200, height: 20 },
    viewport: VIEWPORT,
    ...overrides,
  };
}

describe("computeCopyButtonPlacement", () => {
  it("shows the button below a normal selection", () => {
    const p = computeCopyButtonPlacement(input());
    expect(p).toEqual({ hidden: false, top: 124, left: 220 });
  });

  it("hides when the selection is collapsed", () => {
    expect(computeCopyButtonPlacement(input({ isCollapsed: true }))).toEqual({
      hidden: true,
    });
  });

  it("hides when there is no range", () => {
    expect(computeCopyButtonPlacement(input({ rangeCount: 0 }))).toEqual({
      hidden: true,
    });
  });

  it("hides when the selection is outside the chat container", () => {
    expect(computeCopyButtonPlacement(input({ inContainer: false }))).toEqual({
      hidden: true,
    });
  });

  it("hides when the selection's client rect has zero area", () => {
    const rect = { top: 0, bottom: 0, right: 0, width: 0, height: 0 };
    expect(computeCopyButtonPlacement(input({ rect }))).toEqual({
      hidden: true,
    });
  });

  it("flips the button above the selection when it would overflow the bottom", () => {
    const rect = { top: 760, bottom: 780, right: 300, width: 200, height: 20 };
    expect(computeCopyButtonPlacement(input({ rect }))).toEqual({
      hidden: false,
      top: 728,
      left: 220,
    });
  });

  it("clamps the left edge so the button stays on-screen at the far left", () => {
    const rect = { top: 100, bottom: 120, right: 40, width: 30, height: 20 };
    expect(computeCopyButtonPlacement(input({ rect }))).toMatchObject({
      hidden: false,
      left: 4,
    });
  });

  it("clamps the left edge so the button stays on-screen at the far right", () => {
    const rect = { top: 100, bottom: 120, right: 1000, width: 200, height: 20 };
    expect(computeCopyButtonPlacement(input({ rect }))).toMatchObject({
      hidden: false,
      left: 916,
    });
  });

  // The bug: position is viewport-relative, so the same selection at a
  // scrolled-up rect must yield a different top. This is what makes
  // recomputing on scroll meaningful instead of leaving a stranded button.
  it("follows the selection when it scrolls (different rect -> different top)", () => {
    const before = computeCopyButtonPlacement(
      input({ rect: { top: 380, bottom: 400, right: 300, width: 200, height: 20 } }),
    );
    const after = computeCopyButtonPlacement(
      input({ rect: { top: 180, bottom: 200, right: 300, width: 200, height: 20 } }),
    );
    expect(before).toEqual({ hidden: false, top: 404, left: 220 });
    expect(after).toEqual({ hidden: false, top: 204, left: 220 });
  });
});
