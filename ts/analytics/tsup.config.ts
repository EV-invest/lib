import { defineConfig, type Options } from 'tsup';

// Two builds because the React entry needs a `"use client";` banner and the
// core/node entries must NOT carry one (they run on the server). They share
// `dist/`, so only config #1 may `clean` — letting config #2 clean would wipe
// config #1's freshly emitted `index.*` / `node.*` before they are read.
//
// tsup runs an array's entries CONCURRENTLY, and two parallel `dts` passes over
// the same `dist/` race (one can drop the other's `.d.ts`). So the npm scripts
// invoke tsup twice, sequentially, selecting one config each time via
// `TSUP_ONLY` (`core` then `react`). The array below stays the single source of
// truth for both passes; run with no filter it still builds everything.
const core: Options = {
  // Server-safe entries (no `"use client"`): the core, the posthog-node sink,
  // and the Next.js server helpers (`./next`, which use `next/headers`).
  entry: {
    index: 'src/index.ts',
    node: 'src/node/index.ts',
    next: 'src/next/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  external: ['posthog-node', 'next', 'next/headers'],
};

const react: Options = {
  // Client entries (`"use client"`): the provider/hooks and the App Router
  // page-view tracker (`./next/client`). Built together so they share the
  // `AnalyticsContext` chunk — `PostHogPageView` must read the same context the
  // provider populates.
  entry: { react: 'src/react/index.ts', 'next-client': 'src/next/client.tsx' },
  format: ['esm'],
  dts: true,
  clean: false,
  sourcemap: true,
  target: 'es2022',
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'posthog-js',
    'next',
    'next/navigation',
  ],
  banner: { js: '"use client";' },
};

const only = process.env['TSUP_ONLY'];

export default defineConfig(
  only === 'core' ? [core] : only === 'react' ? [react] : [core, react],
);
