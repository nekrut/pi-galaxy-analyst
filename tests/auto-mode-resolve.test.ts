import { describe, it, expect, afterEach } from "vitest";
import { resolveAutoMode } from "../extensions/loom/exec-guard/guardian-config";
import type { GuardianConfig } from "../extensions/loom/exec-guard/types";

function cfg(autoMode: boolean): GuardianConfig {
  return {
    enabled: true,
    dangerouslyBypassPermissions: false,
    trustedWorkspaces: [],
    extraWorkspaceRoots: [],
    consentAcknowledged: null,
    autoMode,
  };
}

describe("resolveAutoMode", () => {
  const saved: Record<string, string | undefined> = {
    LOOM_AUTO: process.env.LOOM_AUTO,
    LOOM_SAFE: process.env.LOOM_SAFE,
  };
  afterEach(() => {
    for (const key of ["LOOM_AUTO", "LOOM_SAFE"]) {
      const v = saved[key];
      if (v === undefined) delete process.env[key];
      else process.env[key] = v;
    }
  });

  it("follows config when no env override is set", () => {
    delete process.env.LOOM_AUTO;
    delete process.env.LOOM_SAFE;
    expect(resolveAutoMode(cfg(true))).toBe(true);
    expect(resolveAutoMode(cfg(false))).toBe(false);
  });

  it("LOOM_AUTO=1 forces it on regardless of config", () => {
    delete process.env.LOOM_SAFE;
    process.env.LOOM_AUTO = "1";
    expect(resolveAutoMode(cfg(false))).toBe(true);
  });

  it("LOOM_SAFE=1 forces it off, winning over LOOM_AUTO and config", () => {
    process.env.LOOM_SAFE = "1";
    process.env.LOOM_AUTO = "1";
    expect(resolveAutoMode(cfg(true))).toBe(false);
  });
});
