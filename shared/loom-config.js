import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function getConfigDir() {
  return path.join(os.homedir(), ".loom");
}

export function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

export function loadConfig() {
  const p = getConfigPath();
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

export function saveConfig(config) {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + "\n");
}
