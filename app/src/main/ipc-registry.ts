import type { IpcMain } from "electron";

/**
 * Idempotent wrappers over Electron's ipcMain registration.
 *
 * On macOS the app stays alive when every window closes; the follow-up
 * `activate` builds a fresh window and re-runs the per-window IPC registration
 * (registerIpcHandlers / registerFilesIpc). ipcMain.handle throws on a
 * duplicate channel -- "Attempted to register a second handler for
 * 'agent:prompt'" was the reopen-after-close crash (#311) -- and ipcMain.on
 * would silently stack a second listener. Registering through these wrappers
 * removes any prior handler/listener first, so re-registration is safe. The
 * new handler closes over the freshly-created AgentManager, which is exactly
 * what we want on reopen.
 */
export interface IdempotentIpc {
  handle: IpcMain["handle"];
  on: (channel: string, listener: Parameters<IpcMain["on"]>[1]) => void;
}

export function createIdempotentIpc(ipc: IpcMain): IdempotentIpc {
  return {
    handle(channel, listener) {
      ipc.removeHandler(channel);
      ipc.handle(channel, listener);
    },
    on(channel, listener) {
      // removeAllListeners clears the whole channel, which is safe only because
      // the registration fns here are the sole registrar of every channel they
      // touch. Any new ipcMain.on channel must register through this wrapper too.
      ipc.removeAllListeners(channel);
      ipc.on(channel, listener);
    },
  };
}
