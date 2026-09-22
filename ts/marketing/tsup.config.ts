import { defineConfig } from "tsup";

// Two configs so only the React subpath gets the `"use client"` banner. The
// core (`.`) is server-safe and must NOT carry it: its motion tokens, the
// `accented` splitter and the JSON-LD builders are plain values and functions,
// and a plain export of a `"use client"` module is a client *reference* on the
// server — a Server Component importing `STAGGER` would get a proxy, not 0.07.
//
// Kept as ONE array so a bare `tsup` builds everything. Only config #1 cleans
// `dist/`. The entries run concurrently and tsup's `.d.ts` step deletes every
// existing declaration before writing its own when `clean` is set; config #1
// can finish after config #2 and race away `react.d.ts`. The `build`/`prepare`
// scripts therefore re-run config #2 alone afterwards (`tsup.react.config.ts`,
// never cleans) so its declaration survives — same fix as `ts/experiments`.
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    external: ["react", "react/jsx-runtime"],
  },
  {
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
  },
]);
