import { defineConfig } from 'vitest/config';

// Shared config; the node/jsdom split lives in `vitest.workspace.ts` (Vitest
// 2.x workspaces). Keeping the node core verified without ever loading a DOM
// mirrors how it ships.
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
});
