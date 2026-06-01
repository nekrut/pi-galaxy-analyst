import { loadConfig, saveConfig } from "../../../shared/loom-config.js";
import type { GuardianConfig } from "./types";

export function loadGuardianConfig(): GuardianConfig {
  const g = loadConfig().guardian ?? {};
  return {
    enabled: g.enabled !== false,
    dangerouslyBypassPermissions: g.dangerouslyBypassPermissions === true,
    trustedWorkspaces: g.trustedWorkspaces ?? [],
    extraWorkspaceRoots: g.extraWorkspaceRoots ?? [],
    consentAcknowledged: g.consentAcknowledged ?? null,
    autoMode: g.autoMode === true,
  };
}

/**
 * Bypass is ON if (env flag OR config) AND NOT force-off. The agent can never
 * flip the env or config: those are human-only channels (the gate makes
 * writing ~/.loom/config.json gated and editing guardian.* catastrophic).
 */
export function resolveBypass(cfg: GuardianConfig): boolean {
  if (process.env.LOOM_SAFE === "1") return false;
  if (process.env.LOOM_DANGEROUSLY_BYPASS_PERMISSIONS === "1") return true;
  return cfg.dangerouslyBypassPermissions === true;
}

/**
 * Auto mode is ON if (env flag OR config) AND NOT force-off via --safe/LOOM_SAFE.
 * Unlike bypass, auto mode does not weaken the gate -- it adds an OS sandbox under
 * allowed bash -- so it's a normal toggle, not a human-only one.
 */
export function resolveAutoMode(cfg: GuardianConfig): boolean {
  if (process.env.LOOM_SAFE === "1") return false;
  if (process.env.LOOM_AUTO === "1") return true;
  return cfg.autoMode === true;
}

export function trustWorkspace(dir: string): void {
  const cfg = loadConfig();
  const g = cfg.guardian ?? {};
  const set = new Set(g.trustedWorkspaces ?? []);
  set.add(dir);
  cfg.guardian = { ...g, trustedWorkspaces: [...set] };
  saveConfig(cfg);
}

export function recordConsent(version: string): void {
  const cfg = loadConfig();
  cfg.guardian = {
    ...(cfg.guardian ?? {}),
    consentAcknowledged: { version, at: new Date().toISOString() },
  };
  saveConfig(cfg);
}
