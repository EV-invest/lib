import { defineConfig } from 'tsup';

// Two configs so only the React entry carries the `"use client"` banner.
// Server/build-time entries (`index`, `node`, `next`) must NOT be client
// modules — `next` is build/server-time config, and a banner there would make
// the Next.js App Router treat it as a client component.
// `dist` is wiped once by the `build`/`prepare` script before tsup runs, so
// neither config below uses tsup's own `clean`: the two array configs run
// concurrently, and config #1's clean would race-delete config #2's `react.*`
// after the client dts pass had already emitted them.
export default defineConfig([
  // Config #1 — server-safe entries (no banner). `next` is build/server-time
  // config; a `"use client"` banner there would make the App Router treat it as
  // a client component.
  {
    entry: {
      index: 'src/index.ts',
      node: 'src/node/index.ts',
      next: 'src/next/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: false,
    sourcemap: true,
    target: 'es2022',
    external: ['@sentry/node', '@sentry/nextjs', 'next'],
  },
  // Config #2 — the client entry. `"use client"` banner so it can be imported
  // from React Server Components / the Next.js App Router.
  {
    entry: {
      react: 'src/react/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: false,
    sourcemap: true,
    target: 'es2022',
    banner: { js: '"use client";' },
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@sentry/react',
      '@sentry/nextjs',
    ],
  },
]);
