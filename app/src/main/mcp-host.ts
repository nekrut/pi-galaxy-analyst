/**
 * MCP host — Channel 2 server side.
 *
 * Runs in the Electron main process. Opens a TCP listener on 127.0.0.1
 * (random port) and writes the endpoint to ~/.orbit/mcp-endpoint.json so
 * the bundled MCP subprocess (src/mcp-server/server.ts) can discover and
 * connect on startup.
 *
 * Each accepted connection speaks newline-delimited JSON:
 *   in : { id, tool, args }
 *   out: { id, ok, result } | { id, ok: false, error }
 *
 * Tool calls are forwarded to the renderer over IPC and replied to
 * asynchronously when the renderer responds.
 *
 * Prototype assumptions (per user): same machine, one agent per viewer
 * session. We still accept multiple concurrent socket connections so a
 * single agent that fans out tool calls works correctly, but there is no
 * permission/auth check beyond loopback-only binding.
 */
import { createServer, type Server as TcpServer, type Socket } from "node:net";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { ipcMain, type WebContents } from "electron";

const ORBIT_DIR = path.join(os.homedir(), ".orbit");
const ENDPOINT_FILE = path.join(ORBIT_DIR, "mcp-endpoint.json");

function log(...args: unknown[]): void {
  console.log("[mcp-host]", ...args);
}

interface InMessage {
  id: string;
  tool: string;
  args: Record<string, unknown>;
}

interface PendingForward {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

let server: TcpServer | null = null;
let webContents: WebContents | null = null;
const pendingForwards = new Map<string, PendingForward>();
const sockets = new Set<Socket>();

/**
 * Forward a tool call to the renderer and await its response.
 * Renderer is expected to reply via ipcRenderer.send("mcp:tool-response",
 * { forwardId, ok, result?, error? }).
 */
function forwardToRenderer(tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (!webContents || webContents.isDestroyed()) {
    return Promise.reject(new Error("viewer renderer not available"));
  }
  const forwardId = randomUUID();
  return new Promise((resolve, reject) => {
    pendingForwards.set(forwardId, { resolve, reject });
    webContents!.send("mcp:tool-call", { forwardId, tool, args });
  });
}

function handleConnection(socket: Socket): void {
  sockets.add(socket);
  log("client connected; total:", sockets.size);

  let buf = "";

  socket.on("data", (chunk) => {
    buf += chunk.toString("utf-8");
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      let msg: InMessage;
      try {
        msg = JSON.parse(line) as InMessage;
      } catch (e) {
        log("malformed message from client:", line);
        continue;
      }
      handleToolCall(socket, msg);
    }
  });

  socket.on("error", (e) => log("socket error:", e.message));
  socket.on("close", () => {
    sockets.delete(socket);
    log("client disconnected; remaining:", sockets.size);
  });
}

async function handleToolCall(socket: Socket, msg: InMessage): Promise<void> {
  try {
    const result = await forwardToRenderer(msg.tool, msg.args);
    socket.write(JSON.stringify({ id: msg.id, ok: true, result }) + "\n");
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    socket.write(JSON.stringify({ id: msg.id, ok: false, error }) + "\n");
  }
}

export function startMcpHost(initialWebContents: WebContents): void {
  webContents = initialWebContents;
  server = createServer(handleConnection);
  server.on("error", (e) => log("server error:", e.message));
  server.listen(0, "127.0.0.1", () => {
    const addr = server!.address();
    if (!addr || typeof addr === "string") {
      log("listen succeeded but address unavailable");
      return;
    }
    const port = addr.port;
    log("listening on 127.0.0.1:" + port);
    try {
      mkdirSync(ORBIT_DIR, { recursive: true });
      writeFileSync(
        ENDPOINT_FILE,
        JSON.stringify({ port, pid: process.pid, startedAt: new Date().toISOString() }),
      );
      log("wrote endpoint:", ENDPOINT_FILE);
    } catch (e) {
      log("failed to write endpoint file:", e);
    }
  });

  // Renderer responses to forwarded tool calls.
  ipcMain.on(
    "mcp:tool-response",
    (
      _e,
      payload: { forwardId: string; ok: boolean; result?: unknown; error?: string },
    ) => {
      const p = pendingForwards.get(payload.forwardId);
      if (!p) {
        log("response for unknown forwardId:", payload.forwardId);
        return;
      }
      pendingForwards.delete(payload.forwardId);
      if (payload.ok) p.resolve(payload.result);
      else p.reject(new Error(payload.error || "renderer-side error"));
    },
  );
}

export function updateWebContents(wc: WebContents): void {
  webContents = wc;
}

export function stopMcpHost(): void {
  for (const s of sockets) {
    try {
      s.destroy();
    } catch {}
  }
  sockets.clear();
  if (server) {
    try {
      server.close();
    } catch {}
    server = null;
  }
  try {
    unlinkSync(ENDPOINT_FILE);
  } catch {}
  for (const p of pendingForwards.values()) {
    p.reject(new Error("host shutting down"));
  }
  pendingForwards.clear();
}
