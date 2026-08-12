import { defineConfig } from 'tsup';

// Two configs so only the React subpath gets the `"use client"` banner. The
// core (`.`) and Next (`./next`) entries are server-safe and must NOT carry the
// banner — a `"use client"` directive there would opt their importers into the
// client bundle and break `next/headers` / `next/server` usage.
//
// They are kept as ONE array so a bare `tsup` builds everything. Only config #1
// cleans `dist/`. The array entries run concurrently and tsup's `.d.ts` step
// deletes every existing declaration before writing its own (`cleanDtsFiles`,
// gated on `clean`); because config #1 cleans and finishes after config #2, a
// plain `tsup` would race away `react.d.ts`. The `build`/`prepare` scripts
// therefore run config #1 first, then re-run config #2 alone (`--no-clean`,
// via `tsup.react.config.ts`) so its declaration survives.
export default defineConfig([
  // Config #1 — server-safe entries. This is the ONLY config that cleans `dist/`.
  {
    entry: { index: 'src/index.ts', next: 'src/next/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2022',
    external: ['next', 'next/headers', 'next/server'],
  },
  // Config #2 — the client subpath. `"use client"` banner so it can be imported
  // from React Server Components / the Next App Router without `createContext`
  // running on the server.
  {
    entry: { react: 'src/react/index.tsx' },
    format: ['esm'],
    dts: true,
    clean: false,
    sourcemap: true,
    target: 'es2022',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    banner: { js: '"use client";' },
  },
]);
