import { defineWorkspace } from 'vitest/config';

// Split by file suffix: `*.node.test.ts` runs in node (the zero-dep core),
// `*.react.test.tsx` runs in jsdom (the React subpath).
export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'node',
      environment: 'node',
      globals: true,
      include: ['test/**/*.node.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'react',
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./test/setup.react.ts'],
      include: ['test/**/*.react.test.tsx'],
    },
  },
]);
