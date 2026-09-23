import { defineConfig, type Options } from "tsup";

// Two configs so only the client entries get the `"use client"` banner. The
// server-safe entries must NOT carry it: the core's motion tokens, the
// `accented` splitter and the JSON-LD builders are plain values and functions,
// and a plain export of a `"use client"` module is a client *reference* on the
// server — a Server Component importing `STAGGER` would get a proxy, not 0.07.
// The same holds for `./motion-css`, whose whole point is to render on the
// server.
//
// Kept as ONE array so a bare `tsup` builds everything. Only config #1 cleans
// `dist/`. The entries run concurrently and tsup's `.d.ts` step deletes every
// existing declaration before writing its own when `clean` is set; config #1
// can finish after config #2 and race away the client declarations. The
// `build`/`prepare` scripts therefore re-run config #2 alone afterwards
// (`tsup.react.config.ts`, never cleans) so its declarations survive — same
// fix as `ts/experiments`.

/**
 * The `"use client"` entries. One file per subpath, with code splitting so the
 * pieces they share land in chunks instead of copies: an app that imports only
 * the tracker (`./tracker`) does not download `motion`, which it did while
 * `./react` was the only client entry and one bundle.
 */
export const clientConfig = {
  entry: {
    react: "src/react/index.ts",
    motion: "src/motion/index.ts",
    tracker: "src/react/contact-link-tracker.tsx",
    "click-to-load": "src/react/embeds.ts",
    form: "src/react/form/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: false,
  splitting: true,
  sourcemap: true,
  target: "es2022",
  external: ["react", "react-dom", "react/jsx-runtime", "motion", "motion/react", "@evinvest/uikit"],
  // On every emitted file, chunks included: a chunk is only ever reached
  // through a client entry, so everything in it is client code anyway.
  banner: { js: '"use client";' },
} satisfies Options;

/**
 * The Next config helpers, in both module systems. Next compiles a
 * `next.config.ts` to CommonJS and `require`s it, so an import-only export
 * fails there with "Package subpath './next' is not defined by exports".
 */
export const nextConfig = {
  entry: { next: "src/next/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: false,
  sourcemap: true,
  target: "es2022",
} satisfies Options;

export default defineConfig([
  {
    // Server-safe: the core and the zero-JS motion engine.
    entry: { index: "src/index.ts", "motion-css": "src/motion-css/index.tsx" },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    external: ["react", "react/jsx-runtime"],
  },
  clientConfig,
  nextConfig,
]);
