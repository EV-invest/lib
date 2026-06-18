/**
 * Server- and edge-runtime Sentry initialisation.
 *
 * Wraps `Sentry.init` from `@sentry/node` (or any compatible SDK such as
 * `@sentry/nextjs`) with the project's server/edge defaults. This entry carries
 * no `"use client"` banner — it is meant to run in a Node.js or Edge runtime,
 * never in the browser.
 *
 * @packageDocumentation
 */
import { defaultTracesSampleRate } from '../index.js';
import type { SentryInitOptions } from '../index.js';

/**
 * The minimal structural shape this module needs from a server Sentry SDK:
 * just an `init` entry point.
 */
export interface ServerSentryLike {
  /**
   * Initialise the SDK for the current process.
   *
   * @param options - Sentry init options (DSN, environment, sample rates, …).
   */
  init(options: {
    dsn?: string | undefined;
    environment?: string | undefined;
    tracesSampleRate?: number | undefined;
  }): void;
}

/**
 * Initialise Sentry for a Node.js **server** process.
 *
 * Applies server defaults over {@link SentryInitOptions}: `dsn` defaults to
 * `SENTRY_DSN`, `environment` to `APP_ENV ?? "development"`, and
 * `tracesSampleRate` to {@link defaultTracesSampleRate} of `NODE_ENV` (`0.1` in
 * production, `1.0` elsewhere). Explicit `opts` fields override the defaults.
 *
 * Lazily imports `@sentry/node` so importing this module never pulls the SDK
 * into a bundle that does not call `initServer`.
 *
 * @param opts - Overrides for the resolved defaults. Pass `{}` to use defaults.
 * @returns A promise that resolves once the SDK has been initialised.
 *
 * @remarks
 * Env vars consulted for defaults: `SENTRY_DSN`, `APP_ENV`, `NODE_ENV`. When
 * `dsn` resolves to `undefined`, `Sentry.init` is a no-op and monitoring stays
 * disabled — convenient for local dev without a DSN.
 *
 * @example
 * ```ts
 * // sentry.server.config equivalent, called from instrumentation register()
 * import { initServer } from "@evinvest/error-monitoring/node";
 * await initServer({});
 * ```
 */
export async function initServer(opts: SentryInitOptions): Promise<void> {
  const Sentry = (await import('@sentry/node')) as unknown as ServerSentryLike;
  Sentry.init({
    dsn: opts.dsn ?? process.env['SENTRY_DSN'],
    environment: opts.environment ?? process.env['APP_ENV'] ?? 'development',
    tracesSampleRate:
      opts.tracesSampleRate ?? defaultTracesSampleRate(process.env['NODE_ENV']),
  });
}

/**
 * Initialise Sentry for the **Edge** runtime.
 *
 * Like {@link initServer} but tracing is disabled by default
 * (`tracesSampleRate: 0`): edge/middleware logic is lightweight and does not
 * benefit from transaction-level performance data. `dsn` still defaults to
 * `SENTRY_DSN`. Explicit `opts` fields override the defaults.
 *
 * Lazily imports `@sentry/node` so importing this module never pulls the SDK in
 * for callers that do not initialise the edge runtime.
 *
 * @param opts - Overrides for the resolved defaults. Pass `{}` to use defaults.
 * @returns A promise that resolves once the SDK has been initialised.
 *
 * @remarks
 * Env vars consulted for defaults: `SENTRY_DSN`, `APP_ENV`. Default
 * `tracesSampleRate` is `0` (not {@link defaultTracesSampleRate}).
 *
 * @example
 * ```ts
 * import { initEdge } from "@evinvest/error-monitoring/node";
 * await initEdge({});
 * ```
 */
export async function initEdge(opts: SentryInitOptions): Promise<void> {
  const Sentry = (await import('@sentry/node')) as unknown as ServerSentryLike;
  Sentry.init({
    dsn: opts.dsn ?? process.env['SENTRY_DSN'],
    environment: opts.environment ?? process.env['APP_ENV'] ?? 'development',
    tracesSampleRate: opts.tracesSampleRate ?? 0,
  });
}
