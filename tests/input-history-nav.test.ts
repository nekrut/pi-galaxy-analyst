import { describe, expect, test } from "vitest";
import { logicalLineFlags, shouldRecallOnArrow } from "../app/src/renderer/input-history-nav.js";

// `logicalLineFlags` is the geometry-free fallback: it decides first/last
// *logical* line from explicit newlines. It powers prompt-history recall when
// the caret is at the top/bottom of the input.
describe("logicalLineFlags", () => {
  test("a single-line value is both the first and last line everywhere", () => {
    expect(logicalLineFlags("hello", 0)).toEqual({ onFirstLine: true, onLastLine: true });
    expect(logicalLineFlags("hello", 3)).toEqual({ onFirstLine: true, onLastLine: true });
    expect(logicalLineFlags("hello", 5)).toEqual({ onFirstLine: true, onLastLine: true });
  });

  test("empty value is first and last line", () => {
    expect(logicalLineFlags("", 0)).toEqual({ onFirstLine: true, onLastLine: true });
  });

  test("caret on the first of multiple lines: first but not last", () => {
    // "line1\nline2", caret inside line1
    expect(logicalLineFlags("line1\nline2", 3)).toEqual({
      onFirstLine: true,
      onLastLine: false,
    });
    // caret at end of line1, just before the newline
    expect(logicalLineFlags("line1\nline2", 5)).toEqual({
      onFirstLine: true,
      onLastLine: false,
    });
  });

  test("caret on the last line: last but not first", () => {
    // caret at start of line2, just after the newline
    expect(logicalLineFlags("line1\nline2", 6)).toEqual({
      onFirstLine: false,
      onLastLine: true,
    });
    // caret at end of line2
    expect(logicalLineFlags("line1\nline2", 11)).toEqual({
      onFirstLine: false,
      onLastLine: true,
    });
  });

  test("caret on a middle line: neither first nor last", () => {
    expect(logicalLineFlags("a\nb\nc", 3)).toEqual({
      onFirstLine: false,
      onLastLine: false,
    });
  });

  test("caret position is clamped to the value bounds", () => {
    expect(logicalLineFlags("hi", -5)).toEqual({ onFirstLine: true, onLastLine: true });
    expect(logicalLineFlags("hi", 999)).toEqual({ onFirstLine: true, onLastLine: true });
  });
});

// `shouldRecallOnArrow` is the pure decision: recall prompt history (instead of
// moving the caret) only when the caret is on the first line going up, or the
// last line going down -- symmetric in both directions.
describe("shouldRecallOnArrow", () => {
  const first = { onFirstLine: true, onLastLine: false };
  const last = { onFirstLine: false, onLastLine: true };
  const only = { onFirstLine: true, onLastLine: true };
  const middle = { onFirstLine: false, onLastLine: false };

  test("up recalls only when the caret is on the first line", () => {
    expect(shouldRecallOnArrow("up", first)).toBe(true);
    expect(shouldRecallOnArrow("up", only)).toBe(true);
    expect(shouldRecallOnArrow("up", last)).toBe(false);
    expect(shouldRecallOnArrow("up", middle)).toBe(false);
  });

  test("down recalls only when the caret is on the last line", () => {
    expect(shouldRecallOnArrow("down", last)).toBe(true);
    expect(shouldRecallOnArrow("down", only)).toBe(true);
    expect(shouldRecallOnArrow("down", first)).toBe(false);
    expect(shouldRecallOnArrow("down", middle)).toBe(false);
  });
});
