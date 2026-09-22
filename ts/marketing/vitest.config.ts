import { defineConfig } from "vitest/config";

// Shared config; the node/jsdom split lives in `vitest.workspace.ts`.
export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
});
