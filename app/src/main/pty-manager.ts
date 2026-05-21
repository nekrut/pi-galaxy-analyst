/**
 * PTY manager — owns the terminal-pane subprocess.
 *
 * Spawns `claude` (the user-installed Claude Code CLI) in the analysis cwd
 * via node-pty. Streams stdout/stderr to the renderer over IPC; receives
 * keystrokes back. The CLI runs in a real pseudo-tty so colors, scrollback,
 * arrow-key history, and Claude Code's TUI all work as expected.
 *
 * Viewer-mode prototype scope: one PTY per viewer window, hardcoded to
 * `claude`. Follow-ups: pick agent at launch (env var or settings),
 * persist PTY across cwd changes, multi-tab.
 */
import { ipcMain, type WebContents } from "electron";
import { spawn, type IPty } from "node-pty";
import os from "node:os";

function log(...args: unknown[]): void {
  console.log("[pty]", ...args);
}

let pty: IPty | null = null;
let webContents: WebContents | null = null;
let currentCwd: string | null = null;

function shell(): string {
  // node-pty needs a real command. `claude` is on the user's PATH if Claude
  // Code is installed. If it isn't, the spawn fails and the renderer surfaces
  // the exit code — better diagnostic than silently launching a generic shell.
  return process.env.ORBIT_TERMINAL_CMD || "claude";
}

function shellArgs(): string[] {
  const raw = process.env.ORBIT_TERMINAL_ARGS;
  if (!raw) return [];
  // Naive split; good enough for the prototype. Real shell-style quoting
  // can come later if a user actually needs `claude --resume "Some title"`.
  return raw.split(/\s+/).filter(Boolean);
}

export function startPty(wc: WebContents, cwd: string, cols = 80, rows = 24): void {
  webContents = wc;
  stopPty();
  currentCwd = cwd;

  const cmd = shell();
  const args = shellArgs();
  log("spawning:", cmd, args.join(" "), "in", cwd, `${cols}x${rows}`);

  try {
    pty = spawn(cmd, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        // Make sure Claude Code can find its own user-scoped MCP config (which
        // includes the orbit MCP server we registered earlier). On macOS the
        // user's HOME is already in process.env so just inherit.
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("spawn failed:", msg);
    if (webContents && !webContents.isDestroyed()) {
      webContents.send("pty:data", `\r\n[orbit] failed to start "${cmd}": ${msg}\r\n`);
      webContents.send("pty:exit", { code: -1, signal: null });
    }
    return;
  }

  pty.onData((data) => {
    if (webContents && !webContents.isDestroyed()) {
      webContents.send("pty:data", data);
    }
  });

  pty.onExit(({ exitCode, signal }) => {
    log("exited:", exitCode, "signal:", signal);
    if (webContents && !webContents.isDestroyed()) {
      webContents.send("pty:exit", { code: exitCode, signal: signal ?? null });
    }
    pty = null;
  });
}

export function stopPty(): void {
  if (pty) {
    try {
      pty.kill();
    } catch {}
    pty = null;
  }
}

export function registerPtyIpc(): void {
  ipcMain.on("pty:input", (_e, data: string) => {
    if (pty) pty.write(data);
  });

  ipcMain.on("pty:resize", (_e, dims: { cols: number; rows: number }) => {
    if (pty) {
      try {
        pty.resize(dims.cols, dims.rows);
      } catch (err) {
        log("resize failed:", err);
      }
    }
  });

  ipcMain.handle("pty:restart", async () => {
    if (webContents && currentCwd) {
      startPty(webContents, currentCwd);
      return { ok: true };
    }
    return { ok: false, error: "no cwd" };
  });
}
