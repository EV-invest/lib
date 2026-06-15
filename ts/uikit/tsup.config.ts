import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // The kit is interactive (hooks, context, the DOM): mark the bundle a client
  // module so it can be imported from React Server Components / the Next App
  // Router without `createContext` running on the server.
  banner: { js: '"use client";' },
});
