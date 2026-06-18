import { describe, expect, it } from "vitest";
import { createIdempotentIpc } from "../app/src/main/ipc-registry.js";

// A faithful stand-in for Electron's ipcMain. The real `handle` throws on a
// duplicate channel ("Attempted to register a second handler for '<channel>'")
// -- that throw is the #311 crash: on macOS the app survives all windows
// closing, and the follow-up `activate` rebuilds the window and re-runs the
// per-window IPC registration. `removeHandler` clears a handler, `on` stacks
// listeners, `removeAllListeners` clears them.
function makeFakeIpc() {
  const handlers = new Map<string, unknown>();
  const listeners = new Map<string, unknown[]>();
  return {
    handlers,
    listeners,
    handle(channel: string, listener: unknown) {
      if (handlers.has(channel)) {
        throw new Error(`Attempted to register a second handler for '${channel}'`);
      }
      handlers.set(channel, listener);
    },
    removeHandler(channel: string) {
      handlers.delete(channel);
    },
    on(channel: string, listener: unknown) {
      const arr = listeners.get(channel) ?? [];
      arr.push(listener);
      listeners.set(channel, arr);
    },
    removeAllListeners(channel: string) {
      listeners.delete(channel);
    },
  };
}

describe("createIdempotentIpc (#311)", () => {
  it("the fake reproduces Electron's throw on a raw duplicate handle", () => {
    const ipc = makeFakeIpc();
    ipc.handle("agent:prompt", () => {});
    expect(() => ipc.handle("agent:prompt", () => {})).toThrow(
      /Attempted to register a second handler for 'agent:prompt'/,
    );
  });

  it("re-registers a handler without throwing; the latest handler wins", () => {
    const ipc = makeFakeIpc();
    const reg = createIdempotentIpc(ipc as never);
    const first = () => "first";
    const second = () => "second";
    reg.handle("agent:prompt", first as never);
    expect(() => reg.handle("agent:prompt", second as never)).not.toThrow();
    expect(ipc.handlers.get("agent:prompt")).toBe(second);
    expect(ipc.handlers.size).toBe(1);
  });

  it("does not stack duplicate listeners across re-registration", () => {
    const ipc = makeFakeIpc();
    const reg = createIdempotentIpc(ipc as never);
    reg.on("agent:ui-response", (() => {}) as never);
    reg.on("agent:ui-response", (() => {}) as never);
    expect(ipc.listeners.get("agent:ui-response")).toHaveLength(1);
  });

  it("re-running a multi-channel registration block does not throw (window reopen)", () => {
    const ipc = makeFakeIpc();
    const reg = createIdempotentIpc(ipc as never);
    // Mirrors what registerIpcHandlers does on each createWindow: a fixed set
    // of agent:* handlers plus the agent:ui-response listener.
    const register = () => {
      reg.handle("agent:prompt", (() => {}) as never);
      reg.handle("agent:abort", (() => {}) as never);
      reg.on("agent:ui-response", (() => {}) as never);
    };
    register();
    expect(() => register()).not.toThrow();
    expect(ipc.handlers.size).toBe(2);
    expect(ipc.listeners.get("agent:ui-response")).toHaveLength(1);
  });
});
