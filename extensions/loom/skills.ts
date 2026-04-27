/**
 * Skills-repo accessors. Single site that turns the persisted config
 * into the list the agent actually sees — applies the alpha-time
 * github.com/galaxyproject/* allowlist as a defense-in-depth filter
 * (the renderer already blocks at save time, but a hand-edited
 * `~/.loom/config.json` shouldn't be able to bypass).
 *
 * Both the `skills_fetch` tool registration (`tools.ts`) and the
 * system-prompt builder (`context.ts`) import from here so the
 * filter is applied uniformly.
 */

import { loadConfig } from "./config";
import { isAllowedSkillUrl } from "../../shared/loom-config.js";

export interface ConfiguredSkillRepo {
  name: string;
  url: string;
  branch: string;
}

export function listEnabledSkillRepos(): ConfiguredSkillRepo[] {
  const cfg = loadConfig();
  const repos = (cfg.skills?.repos ?? []) as Array<{
    name?: string;
    url?: string;
    branch?: string;
    enabled?: boolean;
  }>;
  const enabled: ConfiguredSkillRepo[] = [];
  for (const r of repos) {
    if (r?.enabled === false) continue;
    if (typeof r?.name !== "string" || typeof r?.url !== "string") continue;
    if (!isAllowedSkillUrl(r.url)) {
      console.warn(
        `[skills] Dropping disallowed repo "${r.name}" (${r.url}) — ` +
        `not under github.com/galaxyproject/*`,
      );
      continue;
    }
    enabled.push({
      name: r.name,
      url: r.url,
      branch: typeof r.branch === "string" && r.branch ? r.branch : "main",
    });
  }
  return enabled;
}

export function findSkillRepo(name: string | undefined): ConfiguredSkillRepo | null {
  const enabled = listEnabledSkillRepos();
  if (enabled.length === 0) return null;
  if (!name) return enabled[0];
  return enabled.find((r) => r.name === name) ?? null;
}
