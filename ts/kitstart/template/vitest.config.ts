import { fileURLToPath } from "node:url";
import { buildEnv } from "@evinvest/kitstart/next/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The marker throws outside a React Server bundle; tests call the
      // server modules directly, which is the point.
      "server-only": fileURLToPath(new URL("./tests/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The facts `next.config.ts` inlines, so the site reads the card here too.
    env: buildEnv(fileURLToPath(new URL(".", import.meta.url))),
  },
});
