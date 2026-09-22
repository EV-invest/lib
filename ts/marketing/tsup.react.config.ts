import { defineConfig } from "tsup";

// Re-emits ONLY the client subpath, with `clean: false`, after the main `tsup`
// run — see the race described in `tsup.config.ts`. Kept identical to config
// #2 there.
export default defineConfig({
  entry: { react: "src/react/index.ts" },
  format: ["esm"],
  dts: true,
  clean: false,
  sourcemap: true,
  target: "es2022",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "motion",
    "motion/react",
    "@evinvest/uikit",
  ],
  banner: { js: '"use client";' },
});
