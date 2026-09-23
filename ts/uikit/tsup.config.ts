import { defineConfig } from 'tsup';

// Two builds into one `dist/`, run in parallel — so neither may `clean` (one
// would wipe the other's output mid-build); the `build` script clears `dist/`
// once, up front.
export default defineConfig([
  {
    // One output file per source module, not one bundle. The kit used to ship
    // as a single bundle under a `"use client"` banner, which made every export
    // a client reference: a Server Component rendering a `Section` or a
    // `Button` sent the whole kit to the browser (~43 KB gz on a landing page)
    // and hydrated markup that has no behaviour. Now each module keeps its own
    // directive — the interactive ones say `"use client"` in source
    // (`test/client-boundary.test.ts` holds that list to what the code does),
    // and the rest render on the server and ship nothing.
    //
    // `bundle: false` keeps the module graph as written; `scripts/fully-specify.mjs`
    // (run by `build`/`prepare` after tsup, with `scripts/emit-barrel.mjs`) adds the `.js` a strict ESM
    // resolver needs to every relative import.
    entry: ['src/**/*.{ts,tsx}', '!src/palette/**', '!src/**/*.d.ts'],
    format: ['esm'],
    bundle: false,
    dts: { entry: { index: 'src/index.ts' } },
    clean: false,
    sourcemap: true,
    target: 'es2022',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  {
    // Build-time tooling for Node: no `"use client"` directive, which would turn
    // an import from a server module into a client reference.
    entry: { palette: 'src/palette/index.ts', 'palette-cli': 'src/palette/cli.ts' },
    format: ['esm'],
    dts: { entry: { palette: 'src/palette/index.ts' } },
    clean: false,
    sourcemap: true,
    target: 'node20',
    platform: 'node',
  },
]);
