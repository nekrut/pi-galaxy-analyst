import { describe, it, expect } from "vitest";
import {
  READONLY_LOOM_TOOLS,
  READONLY_PI_BUILTINS,
  isReadOnly,
} from "../extensions/loom/teams/readonly-registry";

describe("readonly-registry", () => {
  it("exposes a non-empty curated Loom set", () => {
    expect(READONLY_LOOM_TOOLS.size).toBeGreaterThan(0);
  });

  it("classifies Pi built-ins conservatively", () => {
    expect(READONLY_PI_BUILTINS.has("read_file")).toBe(true);
    expect(READONLY_PI_BUILTINS.has("grep")).toBe(true);
    expect(READONLY_PI_BUILTINS.has("list_files")).toBe(true);
    expect(READONLY_PI_BUILTINS.has("glob")).toBe(true);
    expect(READONLY_PI_BUILTINS.has("bash")).toBe(false);
    expect(READONLY_PI_BUILTINS.has("edit_file")).toBe(false);
    expect(READONLY_PI_BUILTINS.has("write_file")).toBe(false);
  });

  it("isReadOnly returns true for curated and built-in reads, false otherwise", () => {
    expect(isReadOnly("read_file")).toBe(true);
    expect(isReadOnly("bash")).toBe(false);
    expect(isReadOnly("__nonexistent__")).toBe(false);
  });
});
