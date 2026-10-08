import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    // The kit and the marketing layer are linked from the workspace, each with
    // its own `node_modules`; one React instance for all of them, or hooks break.
    dedupe: ["react", "react-dom", "@evinvest/uikit"],
    alias: {
      // The marker throws outside a React Server bundle; under test the server
      // modules are exercised directly, which is the point.
      "server-only": fileURLToPath(new URL("./test/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    // `*.node.test.ts(x)` in node — the core must work with no DOM — and
    // `*.react.test.tsx` in jsdom, every lazily loaded part of the kit (today
    // FormSelect's list) loaded first; `*.cold.test.tsx` in jsdom with none of
    // them, for the page that is still fetching them.
    projects: [
      { extends: true, test: { name: "node", environment: "node", include: ["test/**/*.node.test.{ts,tsx}"] } },
      {
        extends: true,
        test: { name: "react", environment: "jsdom", setupFiles: ["./test/setup.dom.ts", "./test/setup.react.ts"], include: ["test/**/*.react.test.tsx"] },
      },
      { extends: true, test: { name: "cold", environment: "jsdom", setupFiles: ["./test/setup.dom.ts"], include: ["test/**/*.cold.test.tsx"] } },
    ],
  },
});
