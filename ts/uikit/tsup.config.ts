import { defineConfig } from 'tsup';

// Two builds into one `dist/`, run in parallel — so neither may `clean` (one
// would wipe the other's output mid-build); the `build` script clears `dist/`
// once, up front.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: false,
    sourcemap: true,
    target: 'es2022',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    // The kit is interactive (hooks, context, the DOM): mark the bundle a client
    // module so it can be imported from React Server Components / the Next App
    // Router without `createContext` running on the server.
    banner: { js: '"use client";' },
  },
  {
    // Build-time tooling for Node: no `"use client"` banner, which would turn
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
