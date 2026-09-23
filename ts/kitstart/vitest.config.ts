import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      // The marker throws outside a React Server bundle; under test the server
      // modules are exercised directly, which is the point.
      "server-only": fileURLToPath(new URL("./test/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    // `*.node.test.ts(x)` in node — the core must work with no DOM — and
    // `*.react.test.tsx` in jsdom.
    projects: [
      { extends: true, test: { name: "node", environment: "node", include: ["test/**/*.node.test.{ts,tsx}"] } },
      { extends: true, test: { name: "react", environment: "jsdom", include: ["test/**/*.react.test.tsx"] } },
    ],
  },
});
