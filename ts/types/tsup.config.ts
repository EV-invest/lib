import { defineConfig } from 'tsup';

// Two-entry build: the server-safe core (`.`) + the client React subpath
// (`./react`) with a `"use client"` banner. Only config #1 cleans `dist/`;
// the React subpath is re-emitted by `tsup.react.config.ts` after the main
// run to keep its declaration intact (see comments there).
export default defineConfig([
  // Config #1 — server-safe entry. This is the ONLY config that cleans `dist/`.
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2022',
  },
  // Config #2 — the client subpath. `"use client"` banner so it can be imported
  // from React Server Components / the Next App Router.
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
