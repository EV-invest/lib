import { defineWorkspace } from "vitest/config";

// Split by file suffix: `*.node.test.ts(x)` runs in node — the core has to
// work with no DOM, because it is what Server Components import — and
// `*.react.test.tsx` runs in jsdom.
export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "node",
      environment: "node",
      globals: true,
      include: ["test/**/*.node.test.{ts,tsx}"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "react",
      environment: "jsdom",
      globals: true,
      setupFiles: ["./test/setup.react.ts"],
      include: ["test/**/*.react.test.tsx"],
    },
  },
]);
