import { defineConfig } from 'vitest/config';

// Per-environment splits live in `vitest.workspace.ts` (vitest 2 workspaces):
// `*.node.test.ts` runs under node, `*.react.test.tsx` under jsdom. This file
// holds the shared base only.
export default defineConfig({
  test: {
    globals: true,
  },
  esbuild: {
    jsx: 'automatic',
  },
});
