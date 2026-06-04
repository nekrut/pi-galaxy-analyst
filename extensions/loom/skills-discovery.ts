import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as parseYaml } from "yaml";

/** The product-surface id Loom claims. A skill opts in with `surfaces: [loom]`. */
export const SURFACE_ID = "loom";

/** Catalog freshness window. SKILL.md frontmatter + the tree listing use this; deep refs stay 24h. */
export const CATALOG_TTL_MS = 60 * 60 * 1000;

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  when_to_use?: string;
  surfaces?: string[];
}

export interface SkillEntry {
  path: string;
  name: string;
  description: string;
  when_to_use?: string;
  surfaces: string[];
}

function toSurfaces(v: unknown): string[] {
  if (typeof v === "string") return [v.trim()].filter(Boolean);
  if (Array.isArray(v)) {
    return v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseFrontmatter(text: string): SkillFrontmatter {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  let data: unknown;
  try {
    data = parseYaml(m[1]);
  } catch {
    return {};
  }
  if (!data || typeof data !== "object") return {};
  const o = data as Record<string, unknown>;
  const fm: SkillFrontmatter = {};
  if (typeof o.name === "string") fm.name = o.name;
  if (typeof o.description === "string") fm.description = o.description;
  if (typeof o.when_to_use === "string") fm.when_to_use = o.when_to_use.trim();
  fm.surfaces = toSurfaces(o.surfaces);
  return fm;
}

/** Tag-or-all: if any entry is tagged for this surface, keep only those; else keep all. */
export function selectSkills(entries: SkillEntry[], surface: string = SURFACE_ID): SkillEntry[] {
  const tagged = entries.filter((e) => e.surfaces.includes(surface));
  return tagged.length ? tagged : entries;
}

export interface ConfiguredSkillRepo {
  name: string;
  url: string;
  branch: string;
}

/** Short stable tag derived from `${url}@${branch}` for the skills-cache directory. */
export function createSkillsCacheTag(url: string, branch: string): string {
  return crypto.createHash("sha256").update(`${url}@${branch}`).digest("hex").slice(0, 8);
}

/** Resolve a github.com repo URL into its raw.githubusercontent.com base, or null. */
export function githubRawBase(repoUrl: string, branch: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(repoUrl);
  } catch {
    return null;
  }
  if (parsed.hostname !== "github.com") return null;
  const segs = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (segs.length < 2) return null;
  const [owner, repo] = segs;
  if (!owner || !repo) return null;
  const cleanRepo = repo.replace(/\.git$/i, "");
  const cleanBranch = (branch || "main").replace(/^\/+|\/+$/g, "");
  return `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${cleanBranch}`;
}

/** The on-disk cache dir for a repo: ~/.loom/cache/skills/<name>@<hash>/ */
export function skillsCacheDir(repo: ConfiguredSkillRepo): string {
  const tag = createSkillsCacheTag(repo.url, repo.branch);
  return path.join(os.homedir(), ".loom", "cache", "skills", `${repo.name}@${tag}`);
}

export type FetchSkillResult =
  | { ok: true; text: string; cached: boolean }
  | { ok: false; status?: number; error: string };

/**
 * Fetch one file from a skills repo, reading/writing the same on-disk cache the
 * `skills_fetch` tool uses. SKILL.md files use the 1h catalog TTL (they ARE the
 * catalog); everything else (deep reference docs) keeps the 24h content TTL.
 * `cleanPath` must already be normalized (no leading slash, no `..`).
 */
export async function fetchSkillFile(
  repo: ConfiguredSkillRepo,
  cleanPath: string,
  signal?: AbortSignal,
): Promise<FetchSkillResult> {
  const rawBase = githubRawBase(repo.url, repo.branch);
  if (!rawBase) return { ok: false, error: `Repo URL "${repo.url}" is not a GitHub repo URL.` };

  const cachePath = path.join(skillsCacheDir(repo), cleanPath);
  const ttlMs = cleanPath.endsWith("SKILL.md") ? CATALOG_TTL_MS : 24 * 60 * 60 * 1000;
  try {
    const stat = fs.statSync(cachePath);
    if (Date.now() - stat.mtimeMs < ttlMs) {
      return { ok: true, text: fs.readFileSync(cachePath, "utf-8"), cached: true };
    }
  } catch {
    // cache miss -- fall through to fetch
  }

  let response: Response;
  try {
    response = await fetch(`${rawBase}/${cleanPath}`, { signal });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
  const text = await response.text();
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, text, "utf-8");
  } catch (err) {
    console.error("[skills] cache write failed:", err);
  }
  return { ok: true, text, cached: false };
}
