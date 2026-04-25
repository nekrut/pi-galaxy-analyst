/**
 * Session state — connection, notebook path, file watcher, listeners.
 *
 * The notebook (notebook.md in the session cwd) is the durable record. State
 * here is just enough to wire the file watcher, track Galaxy connection, and
 * route notebook changes to UI listeners.
 */

import type { AnalystState } from "./types";
import { getDefaultNotebookPath } from "./notebook-writer";
import { commitFile, ensureGitRepo } from "./git";
import { appendActivityEvent, loadActivityLog, resetActivity } from "./activity";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Module state
// ─────────────────────────────────────────────────────────────────────────────

let state: AnalystState = {
  galaxyConnected: false,
  currentHistoryId: null,
  notebookPath: null,
  notebookLoaded: false,
};

export function getState(): AnalystState {
  return state;
}

export function resetState(): void {
  stopWatchingNotebook();
  state = {
    galaxyConnected: false,
    currentHistoryId: null,
    notebookPath: null,
    notebookLoaded: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notebook change listeners
// ─────────────────────────────────────────────────────────────────────────────

type NotebookChangeListener = (markdown: string) => void;
const notebookChangeListeners: NotebookChangeListener[] = [];

/** Register a callback that fires on every notebook write. Returns unsubscribe. */
export function onNotebookChange(listener: NotebookChangeListener): () => void {
  notebookChangeListeners.push(listener);
  return () => {
    const idx = notebookChangeListeners.indexOf(listener);
    if (idx >= 0) notebookChangeListeners.splice(idx, 1);
  };
}

function notifyNotebookChange(markdown: string): void {
  for (const listener of notebookChangeListeners) {
    listener(markdown);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File watcher — refresh UI + auto-commit on every notebook write
// ─────────────────────────────────────────────────────────────────────────────

let currentWatcher: fs.FSWatcher | null = null;
let watcherPath: string | null = null;
let watcherDebounce: NodeJS.Timeout | null = null;

function startWatchingNotebook(filePath: string): void {
  stopWatchingNotebook();
  if (!fs.existsSync(filePath)) return;
  try {
    currentWatcher = fs.watch(filePath, () => {
      if (watcherDebounce) clearTimeout(watcherDebounce);
      watcherDebounce = setTimeout(() => {
        watcherDebounce = null;
        if (watcherPath && fs.existsSync(watcherPath)) {
          try {
            const content = fs.readFileSync(watcherPath, "utf-8");
            notifyNotebookChange(content);
            commitFile(watcherPath, "Notebook updated");
          } catch (err) {
            console.error("notebook watcher read failed:", err);
          }
        }
      }, 60);
    });
    watcherPath = filePath;
  } catch (err) {
    console.error("failed to start notebook watcher:", err);
  }
}

function stopWatchingNotebook(): void {
  if (watcherDebounce) {
    clearTimeout(watcherDebounce);
    watcherDebounce = null;
  }
  if (currentWatcher) {
    try { currentWatcher.close(); } catch { /* ignore */ }
    currentWatcher = null;
  }
  watcherPath = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notebook path
// ─────────────────────────────────────────────────────────────────────────────

export function getNotebookPath(): string | null {
  return state.notebookPath;
}

export function setNotebookPath(notebookFile: string | null): void {
  state.notebookPath = notebookFile;
  state.notebookLoaded = notebookFile !== null;
  if (notebookFile) {
    startWatchingNotebook(notebookFile);
    loadActivityLog(path.dirname(notebookFile));
  } else {
    stopWatchingNotebook();
    resetActivity();
  }
}

export function isNotebookLoaded(): boolean {
  return state.notebookLoaded;
}

export function getDefaultPath(_title: string, directory: string): string {
  return getDefaultNotebookPath(_title, directory);
}

/**
 * Ensure every session has a notebook.md in cwd. Creates an empty file if
 * missing, attaches the watcher, hydrates the activity log, and emits the
 * first notebook-change notification so the Notebook pane paints immediately.
 * Idempotent; safe to call every session_start.
 */
export function initSessionArtifacts(cwd: string): void {
  const notebookPath = path.join(cwd, "notebook.md");
  const sessionDir = cwd;

  try {
    ensureGitRepo(cwd);

    if (!fs.existsSync(notebookPath)) {
      fs.writeFileSync(notebookPath, "", "utf-8");
      commitFile(notebookPath, "Initialize notebook");
    }

    state.notebookPath = notebookPath;
    state.notebookLoaded = true;
    startWatchingNotebook(notebookPath);
    loadActivityLog(sessionDir);

    const content = fs.readFileSync(notebookPath, "utf-8");
    notifyNotebookChange(content);

    appendActivityEvent(sessionDir, {
      timestamp: new Date().toISOString(),
      kind: "session.started",
      source: "session_bootstrap",
      payload: { cwd },
    });
  } catch (err) {
    console.error("initSessionArtifacts failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Galaxy connection state
// ─────────────────────────────────────────────────────────────────────────────

export function setGalaxyConnection(connected: boolean, historyId?: string, _serverUrl?: string): void {
  state.galaxyConnected = connected;
  if (historyId) {
    state.currentHistoryId = historyId;
  }
}

export function getCurrentHistoryId(): string | null {
  return state.currentHistoryId;
}

export function isGalaxyConnected(): boolean {
  return state.galaxyConnected;
}
