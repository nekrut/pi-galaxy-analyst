import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const DEFAULT_SKILLS = [
  {
    name: "galaxy-skills",
    url: "https://github.com/galaxyproject/galaxy-skills",
    branch: "main",
    enabled: true,
  },
];

export function getConfigDir() {
  return path.join(os.homedir(), ".loom");
}

export function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

export function loadConfig() {
  const p = getConfigPath();
  let raw = {};
  if (fs.existsSync(p)) {
    try {
      raw = JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      raw = {};
    }
  }
  // Lazy-seed default skills repo if the user hasn't configured any. This
  // also re-seeds galaxy-skills if every repo was removed manually — feels
  // less surprising than silently leaving it absent.
  if (!raw.skills || !Array.isArray(raw.skills.repos) || raw.skills.repos.length === 0) {
    raw.skills = { repos: [...DEFAULT_SKILLS] };
  }
  return raw;
}

export function saveConfig(config) {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + "\n");
}
