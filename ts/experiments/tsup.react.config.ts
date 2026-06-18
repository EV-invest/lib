import { defineConfig } from 'tsup';

// Re-emits ONLY the client subpath, with `clean: false`, after the main `tsup`
// run (see `tsup.config.ts`). tsup's `.d.ts` step deletes every existing
// declaration before writing its own when `clean` is set, and the main array's
// concurrent `clean: true` config finishes last — racing away `react.d.ts`.
// Running this config last (it never cleans) restores `dist/react.d.ts` without
// touching `index.d.ts` / `next.d.ts`. Kept byte-identical to config #2 of the
// main file.
export default defineConfig({
  entry: { react: 'src/react/index.tsx' },
  format: ['esm'],
  dts: true,
  clean: false,
  sourcemap: true,
  target: 'es2022',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  banner: { js: '"use client";' },
});
