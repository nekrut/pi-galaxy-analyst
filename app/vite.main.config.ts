import { defineConfig } from "vite";
import { builtinModules } from "node:module";

export default defineConfig({
  resolve: {
    conditions: ["node"],
  },
  build: {
    rollupOptions: {
      // Native modules can't be bundled — node-pty does a dynamic
      // require("./prebuilds/<plat>/pty.node") that rollup can't statically
      // analyze. Marking external + having forge pack node_modules makes
      // the runtime require chain work as expected.
      external: [
        "electron",
        "node-pty",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
  },
});
