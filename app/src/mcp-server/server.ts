/**
 * Orbit MCP server — Channel 2 bridge.
 *
 * Spawned as a stdio subprocess by an MCP-aware agent (Claude Code, pi.dev,
 * etc.). Speaks MCP over stdio to the agent; forwards tool calls to the
 * running Orbit viewer over a 127.0.0.1 TCP socket. The endpoint is
 * discovered via ~/.orbit/mcp-endpoint.json which the viewer writes when it
 * opens its TCP listener.
 *
 * Assumes same-machine, single-agent-per-viewer (see prototype scope).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { connect, type Socket } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

interface HostEndpoint {
  port: number;
  pid: number;
  startedAt: string;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

const ENDPOINT_FILE = path.join(os.homedir(), ".orbit", "mcp-endpoint.json");

function readEndpoint(): HostEndpoint {
  const raw = readFileSync(ENDPOINT_FILE, "utf-8");
  return JSON.parse(raw) as HostEndpoint;
}

function err(...args: unknown[]): void {
  // stderr-only — stdout is the MCP protocol channel.
  console.error("[orbit-mcp]", ...args);
}

class HostBridge {
  private socket: Socket | null = null;
  private pending = new Map<string, PendingCall>();
  private buf = "";

  async connect(): Promise<void> {
    let endpoint: HostEndpoint;
    try {
      endpoint = readEndpoint();
    } catch (e) {
      throw new Error(
        `Orbit viewer not running (no ${ENDPOINT_FILE}). ` +
          `Start Orbit before invoking this MCP server.`,
      );
    }
    return new Promise((resolve, reject) => {
      const sock = connect({ host: "127.0.0.1", port: endpoint.port }, () => {
        this.socket = sock;
        resolve();
      });
      sock.on("data", (chunk) => this.onData(chunk));
      sock.on("error", (e) => {
        for (const p of this.pending.values()) p.reject(e);
        this.pending.clear();
        if (!this.socket) reject(e);
      });
      sock.on("close", () => {
        for (const p of this.pending.values()) p.reject(new Error("viewer disconnected"));
        this.pending.clear();
        this.socket = null;
      });
    });
  }

  private onData(chunk: Buffer): void {
    this.buf += chunk.toString("utf-8");
    let nl;
    while ((nl = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 1);
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as {
          id: string;
          ok: boolean;
          result?: unknown;
          error?: string;
        };
        const p = this.pending.get(msg.id);
        if (!p) {
          err("response for unknown id:", msg.id);
          continue;
        }
        this.pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.result);
        else p.reject(new Error(msg.error || "viewer-side error"));
      } catch (e) {
        err("malformed host message:", line, e);
      }
    }
  }

  call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.socket) return Promise.reject(new Error("not connected"));
    const id = randomUUID();
    const payload = JSON.stringify({ id, tool, args }) + "\n";
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket!.write(payload);
    });
  }
}

const bridge = new HostBridge();

const TOOLS = [
  {
    name: "notify",
    description:
      "Show a toast notification in the Orbit viewer. Use to surface non-blocking " +
      "status messages (info, warning, error) without interrupting the user.",
    inputSchema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["info", "warning", "error"],
          description: "Severity of the message",
        },
        message: { type: "string", description: "Short text to display" },
      },
      required: ["level", "message"],
    },
  },
  {
    name: "request_confirmation",
    description:
      "Ask the user to confirm or cancel an action. Blocks until the user clicks " +
      "in the Orbit viewer. Use before destructive or expensive operations.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Question to display to the user" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "get_execution_preference",
    description:
      "Read the user's current execution-mode preference from the Orbit viewer's " +
      "footer toggle. Use this before deciding whether to route a task locally or " +
      "to Galaxy. Returns { preference: 'local' | 'cloud' } where 'cloud' means " +
      "the agent may route steps to Galaxy.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

const server = new Server(
  { name: "orbit", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    const result = await bridge.call(name, args as Record<string, unknown>);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      isError: true,
      content: [{ type: "text", text: `Orbit MCP error: ${msg}` }],
    };
  }
});

async function main(): Promise<void> {
  try {
    await bridge.connect();
    err("connected to viewer");
  } catch (e) {
    err("could not connect to viewer:", e);
    // We still serve MCP — every tool call will return an error explaining
    // the viewer isn't running. That's a better UX than crashing the agent.
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  err("stdio transport ready");
}

main().catch((e) => {
  err("fatal:", e);
  process.exit(1);
});
