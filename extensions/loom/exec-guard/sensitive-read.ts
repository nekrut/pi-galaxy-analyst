import * as path from "path";

// Directories under $HOME that hold credentials/secrets.
const SENSITIVE_HOME_DIRS = [
  ".ssh",
  ".aws",
  ".gnupg",
  ".config/gcloud",
  ".kube",
  ".docker",
  "Library/Keychains",
];
// Exact files under $HOME.
const SENSITIVE_HOME_FILES = [".netrc", ".loom/config.json", ".pgpass", ".npmrc"];
// Basename / extension patterns sensitive anywhere.
const SENSITIVE_BASENAME =
  /^(\.env(\..+)?|id_rsa|id_ed25519|id_ecdsa|.*\.pem|.*\.key|.*\.keychain(-db)?|credentials)$/i;

function within(abs: string, dir: string): boolean {
  const rel = path.relative(dir, abs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function isSensitivePath(absPath: string, home: string): boolean {
  const norm = path.normalize(absPath);
  for (const d of SENSITIVE_HOME_DIRS) if (within(norm, path.join(home, d))) return true;
  for (const f of SENSITIVE_HOME_FILES) if (norm === path.join(home, f)) return true;
  if (SENSITIVE_BASENAME.test(path.basename(norm))) return true;
  return false;
}

// Write targets gated even inside the workspace jail. A file under `.git`
// (hooks run on the next git operation; config can redirect hooksPath) or under
// `.loom` (Loom's own session state) should never be written by the model
// silently -- it uses git commands for repo ops, not the write tool.
//
// `workspaceRoot` matters because Orbit's default workspace is ~/.loom/analyses/<name>,
// so the workspace's own ancestry already contains a `.loom` segment. Only `.git`/`.loom`
// at or below the workspace root should gate; an ancestor `.loom` (the path *to* the
// workspace) is incidental and must not flag every write. When the path is inside the
// workspace we evaluate segments relative to its root; otherwise we check the absolute
// path so escapes to some other repo's .git / Loom's home state stay gated.
export function isProtectedWritePath(absPath: string, workspaceRoot?: string): boolean {
  const norm = path.normalize(absPath);
  const considered =
    workspaceRoot && within(norm, workspaceRoot) ? path.relative(workspaceRoot, norm) : norm;
  const segments = considered.split(path.sep);
  return segments.includes(".git") || segments.includes(".loom");
}
