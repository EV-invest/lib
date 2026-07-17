import { defineConfig } from 'tsup';

// One server-safe, browser-safe entry — no React subpath, so no `"use client"`
// banner and none of the dual-config dance the other packages need.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
});
