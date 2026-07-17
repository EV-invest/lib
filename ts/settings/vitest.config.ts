import { defineConfig } from 'vitest/config';

// Node only: the package never touches a DOM, so there is no jsdom project and
// no workspace split — mirroring how the core ships.
export default defineConfig({
  test: {
    name: 'node',
    environment: 'node',
    globals: true,
    include: ['test/**/*.node.test.ts'],
  },
});
