import { defineWorkspace } from 'vitest/config';

// vitest 2 workspaces: one project per environment, selected by filename.
export default defineWorkspace([
  {
    test: {
      name: 'node',
      environment: 'node',
      include: ['test/**/*.node.test.ts'],
      globals: true,
    },
    esbuild: { jsx: 'automatic' },
  },
  {
    test: {
      name: 'react',
      environment: 'jsdom',
      include: ['test/**/*.react.test.tsx'],
      globals: true,
      setupFiles: ['./test/setup.ts'],
    },
    esbuild: { jsx: 'automatic' },
  },
]);
