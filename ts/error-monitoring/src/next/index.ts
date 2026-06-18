/**
 * Next.js wiring for Sentry: the instrumentation `register()` hook, the
 * `onRequestError` capture handler, and a `next.config` wrapper.
 *
 * This entry is **build- and server-time only** (it is imported by
 * `instrumentation.ts` and `next.config`), so it carries no `"use client"`
 * banner — a banner here would make the App Router treat it as a client module.
 *
 * @packageDocumentation
 */
import { initServer, initEdge } from '../node/index.js';
import type { SentryInitOptions } from '../index.js';

export { captureRequestError } from '@sentry/nextjs';

/**
 * Next.js instrumentation hook — call this from your `register()` in
 * `instrumentation.ts`. Runs once per server process on startup and initialises
 * the correct Sentry runtime:
 *
 * - `NEXT_RUNTIME === "nodejs"` → {@link initServer} (API routes, RSC, SSR).
 * - `NEXT_RUNTIME === "edge"`   → {@link initEdge} (middleware / proxy).
 *
 * Each branch dynamic-imports its initialiser so only the active runtime's code
 * is loaded.
 *
 * @param opts - Init overrides forwarded to {@link initServer} / {@link initEdge}.
 *   Defaults to `{}` (use the adapter defaults / env vars).
 * @returns A promise that resolves once the matching runtime is initialised.
 *
 * @remarks
 * Reads `process.env.NEXT_RUNTIME` (set by Next.js). Underlying env vars:
 * `SENTRY_DSN`, `APP_ENV`, `NODE_ENV` — see {@link SentryInitOptions}.
 *
 * @example
 * ```ts
 * // instrumentation.ts
 * import { register as emRegister, captureRequestError } from "@evinvest/error-monitoring/next";
 * export const register = () => emRegister();
 * export const onRequestError = captureRequestError;
 * ```
 */
export async function register(opts: SentryInitOptions = {}): Promise<void> {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    await initServer(opts);
  }
  if (process.env['NEXT_RUNTIME'] === 'edge') {
    await initEdge(opts);
  }
}

/**
 * Options for {@link withSentry}: forwarded verbatim to `withSentryConfig`.
 *
 * @remarks
 * Common fields are `org`, `project`, and `authToken` (read from
 * `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`), plus build flags such
 * as `silent`, `widenClientFileUpload`, and `sourcemaps`. See the
 * `@sentry/nextjs` docs for the full set.
 */
export type WithSentryOptions = Parameters<
  typeof import('@sentry/nextjs').withSentryConfig
>[1];

/**
 * Wrap a Next.js config with Sentry's build-time integration (source-map
 * upload, server instrumentation injection). A thin pass-through over
 * `withSentryConfig`.
 *
 * @param nextConfig - Your Next.js config object.
 * @param opts - Options forwarded to `withSentryConfig` (org/project/authToken,
 *   `sourcemaps`, …). Defaults to `{}`.
 * @returns The wrapped Next.js config.
 *
 * @remarks
 * Source-map upload needs `SENTRY_AUTH_TOKEN` (plus `SENTRY_ORG` /
 * `SENTRY_PROJECT`) at build time. Without them the wrapper is effectively a
 * no-op and your stack traces stay minified.
 *
 * @example
 * ```ts
 * // next.config.ts
 * import { withSentry } from "@evinvest/error-monitoring/next";
 * import type { NextConfig } from "next";
 *
 * const nextConfig: NextConfig = { reactStrictMode: true };
 *
 * export default withSentry(nextConfig, {
 *   org: process.env.SENTRY_ORG,
 *   project: process.env.SENTRY_PROJECT,
 *   authToken: process.env.SENTRY_AUTH_TOKEN,
 *   silent: !process.env.CI,
 *   widenClientFileUpload: true,
 *   sourcemaps: { filesToDeleteAfterUpload: [".next/(asterisks)/(star).map"] },
 * });
 * ```
 *
 * (Replace the `(asterisks)/(star)` placeholder with a real `glob` — written
 * this way only to avoid prematurely closing this doc comment.)
 */
export async function withSentry<TConfig>(
  nextConfig: TConfig,
  opts: WithSentryOptions = {},
): Promise<TConfig> {
  const { withSentryConfig } = await import('@sentry/nextjs');
  return withSentryConfig(nextConfig, opts) as TConfig;
}
