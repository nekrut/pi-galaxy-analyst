import { defineConfig } from "vite";
import { builtinModules } from "node:module";

// Bundles the stdio MCP server (src/mcp-server/server.ts) as a single CJS file
// the agent can invoke directly via `node <bundle>`. Same `node` conditions as
// the main process build so @modelcontextprotocol/sdk resolves correctly.
//
// node:* built-ins must be external — without this, vite's default browser-lib
// posture rewrites them to a virtual `__vite-browser-external` and the bundle
// blows up at runtime (and at build time when imports like readFileSync are
// resolved against the virtual module).
export default defineConfig({
  resolve: {
    conditions: ["node"],
  },
  ssr: {
    target: "node",
    noExternal: true,
  },
  build: {
    target: "node22",
    ssr: "src/mcp-server/server.ts",
    outDir: ".vite/build",
    emptyOutDir: false,
    rollupOptions: {
      external: [
        "electron",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        format: "cjs",
        entryFileNames: "orbit-mcp-server.cjs",
      },
    },
  },
});
