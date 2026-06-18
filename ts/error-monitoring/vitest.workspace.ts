import { defineWorkspace } from 'vitest/config';

// Two test projects keyed by file-name glob, each with its own environment:
// the core sink and the `register()` runtime switch run under node; the
// `ErrorBoundary` suite needs a DOM, so it runs under jsdom.
export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'node',
      environment: 'node',
      include: ['test/**/*.node.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'react',
      environment: 'jsdom',
      include: ['test/**/*.react.test.tsx'],
      setupFiles: ['./test/setup.react.ts'],
    },
  },
]);
