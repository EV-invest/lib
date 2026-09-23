/**
 * `@evinvest/kitstart/next/config` — for `next.config.ts` and
 * `vitest.config.ts` only. Its own subpath because the config is loaded
 * outside any React Server bundle, where `./next` (which reaches
 * `server-only` modules) would throw on import.
 */
import type { NextConfig } from "next";
import { buildEnv } from "./build-env";

export { buildEnv, readCard, readMarkPath, readOgPalette, readStringTables, type CardFacts, type OgPalette } from "./build-env";

export interface LandingOptions {
  /** The brand repo's root, where `assets/` lives: `process.cwd()` in `next.config.ts`. */
  root: string;
  /** Files the OG route reads at run time, which tracing cannot infer from a path. */
  ogFiles?: string[];
}

/**
 * The Next config every landing shares, under the brand's own. What each line
 * is for:
 *
 * - `output: "standalone"` — the image ships the server plus only the traced
 *   files, not the toolchain;
 * - `env` — the card's facts, the mark and the OG palette inlined at build:
 *   the container carries no `assets/`;
 * - `expireTime` — pages are cached (ISR) on the live data's TTL; this bounds
 *   the `stale-while-revalidate` tail a CDN may serve to a day, not a year;
 * - `images.unoptimized` + the sharp exclusion — the optimiser would add a
 *   native dependency the Nix image cannot load, for sources already sized;
 * - `isrFlushToDisk: false` — the server runs from the read-only Nix store, so
 *   the cache stays in memory, per pod.
 */
export function withLanding(config: NextConfig, options: LandingOptions): NextConfig {
  return {
    poweredByHeader: false,
    output: "standalone",
    expireTime: 86_400,
    ...config,
    env: { ...buildEnv(options.root), ...config.env },
    images: { unoptimized: true, ...config.images },
    outputFileTracingIncludes: {
      ...(options.ogFiles ? { "/og": options.ogFiles } : {}),
      ...config.outputFileTracingIncludes,
    },
    outputFileTracingExcludes: {
      "*": ["node_modules/sharp/**", "node_modules/@img/**"],
      ...config.outputFileTracingExcludes,
    },
    // `app/global-not-found.tsx` answers every path no route matches — the proxy
    // sends dead paths there (`gone`); the root layout lives under `[locale]`.
    experimental: { isrFlushToDisk: false, globalNotFound: true, ...config.experimental },
  };
}
