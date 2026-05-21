# Orbit MCP server (prototype)

Channel-2 of the [viewer ⇄ agent communication design](https://github.com/galaxyproject/loom/pull/...).
The viewer hosts a local TCP listener on 127.0.0.1 (random port). The bundled
MCP server subprocess is spawned by your agent (Claude Code, pi.dev, etc.),
discovers the viewer via `~/.orbit/mcp-endpoint.json`, and forwards tool
calls over MCP stdio ⇄ TCP ⇄ Electron IPC ⇄ renderer UI.

**Scope of this prototype** — same-machine, one agent per viewer session.
No auth beyond loopback binding.

## What's wired

Three tools, exposed to the agent:

| Tool | Behavior |
|---|---|
| `notify(level, message)` | top-right toast in the viewer; level ∈ {info, warning, error} |
| `request_confirmation(prompt)` | modal blocks until user clicks Yes/No; returns `{confirmed: bool}` |
| `get_execution_preference()` | returns `{preference: "auto"}` (stub; real impl reads project config) |

## How to use with Claude Code

1. `cd app && npm start` (launches the viewer; opens the TCP listener; writes
   `~/.orbit/mcp-endpoint.json`).
2. In a separate terminal:
   ```
   claude mcp add orbit -- node /path/to/pi-galaxy-analyst/app/.vite/build/orbit-mcp-server.cjs
   ```
   Adjust the path to match where the vite bundle landed.
3. Start Claude Code: `claude`.
4. Ask Claude to use the Orbit tools:
   - "Use the orbit tool to notify the user that the build finished."
   - "Use the orbit tool to ask the user whether to proceed with the destructive operation."

The viewer pops a toast or a modal in response. Confirmation modals block the
agent's tool call until the user clicks; the result comes back as
`{confirmed: true}` or `{confirmed: false}`.

## How to use with pi.dev (pi-coding-agent)

pi-agent-core has an MCP client. Add to its config:
```yaml
mcp:
  servers:
    orbit:
      command: node
      args: [/path/to/pi-galaxy-analyst/app/.vite/build/orbit-mcp-server.cjs]
```
(Exact config path depends on pi version; consult upstream docs.)

## Wire diagram

```
  Agent (Claude Code / pi.dev / ...)
        │ MCP stdio (JSON-RPC)
        ▼
  orbit-mcp-server.cjs        (subprocess — bundled with viewer)
        │ JSON-line over TCP 127.0.0.1:<port>
        ▼
  Electron main: mcp-host.ts  (TCP listener; one per viewer)
        │ IPC "mcp:tool-call"
        ▼
  Renderer: handler in app.ts (toast / modal / lookup)
        │ IPC "mcp:tool-response"
        ▲
  back through to host → socket → MCP server → agent
```

## Endpoint discovery

When the viewer starts, `~/.orbit/mcp-endpoint.json` is written:
```json
{ "port": 49234, "pid": 12345, "startedAt": "2026-05-21T..." }
```
The MCP subprocess reads this on startup and connects. If the file is missing
(viewer not running), every tool call returns `Orbit MCP error: Orbit viewer
not running ...` so the agent gets a usable diagnostic instead of hanging.

## Smoke test recipe

```
# Terminal A
cd app && npm start
# wait for window to appear

# Terminal B (after viewer is up)
ls ~/.orbit/mcp-endpoint.json     # should exist
claude mcp add orbit -- node \
  "$(pwd)/.vite/build/orbit-mcp-server.cjs"
claude
> tell the orbit user "hello from the agent" using the notify tool
```

Expect: toast appears in top-right of viewer.

```
> use orbit to ask the user "delete everything?"
```

Expect: modal appears; clicking No returns `{confirmed: false}` to the agent.

## Files

| Path | Role |
|---|---|
| `src/mcp-server/server.ts` | stdio MCP server, spawned by agent |
| `src/main/mcp-host.ts` | TCP listener in Electron main |
| `src/preload/preload.ts` | IPC bridge (`onMcpToolCall`, `respondToMcpToolCall`) |
| `src/renderer/app.ts` | tool dispatch + UI |
| `src/renderer/index.html` | toast container + confirm modal markup |
| `src/renderer/styles.css` | toast styling |
| `vite.mcp.config.ts` | bundles the MCP server as `orbit-mcp-server.cjs` |
| `forge.config.ts` | adds the MCP server as a build target |

## Known limitations (prototype)

- No project-level config — `get_execution_preference` returns a hardcoded value.
- No reconnection — if viewer is killed and restarted, the MCP subprocess
  needs a restart too (agent restart is the easiest path).
- Multiple viewers running → last one wins (endpoint file overwritten).
- No `request_choice` (menu picker) yet — easy add following `request_confirmation`.
- No `set_status` (header status line) yet.
- No `mark_artifact_active` yet.
- Tool calls are not throttled — a chatty agent could spam toasts.

## Next steps

- Project-level config (`.orbit/config.json`) read by `get_execution_preference`.
- Toggle in viewer UI that writes the same config and broadcasts change.
- `set_status`, `mark_artifact_active`, `request_choice`.
- Multi-viewer support (per-project endpoint files keyed on cwd hash).
