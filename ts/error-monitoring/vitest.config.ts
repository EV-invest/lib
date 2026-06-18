import { defineConfig } from 'vitest/config';

// Shared base. The per-environment split lives in `vitest.workspace.ts`:
// vitest 2.x expresses "projects keyed by glob" via `defineWorkspace`, not a
// `test.projects` field (that key only exists in vitest 3).
//   *.node.test.ts   → node
//   *.react.test.tsx → jsdom
export default defineConfig({
  test: {
    globals: true,
  },
  esbuild: {
    jsx: 'automatic',
  },
});
