import { defineConfig } from 'tsup';

// Server-safe entry. This is the ONLY config that cleans `dist/`.
// The React subpath is built separately via `tsup.react.config.ts` to avoid
// a DTS race (it resolves `@evinvest/types` from dist/, so it must run after
// the main entry's declarations are written).
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
});
