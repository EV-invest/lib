/**
 * Vendor-neutral error-monitoring core.
 *
 * This entry imports **no** monitoring SDK — it defines the {@link ErrorSink}
 * port and the small structural seams that the `./react`, `./node`, and
 * `./next` adapters plug a concrete vendor (Sentry) into. Application code
 * depends on {@link ErrorSink}, never on a vendor, so the vendor can be swapped
 * without touching call sites.
 *
 * It is safe to import from any runtime — server, edge, browser — because it
 * pulls in nothing host-specific.
 *
 * @packageDocumentation
 */

/**
 * The single seam through which the application reports unexpected errors.
 *
 * Implement this with {@link createSentrySink} (or any other vendor), or use
 * {@link noopErrorSink} when monitoring is not configured. Application code
 * should depend on this interface rather than on a concrete SDK so the vendor
 * can be swapped without touching call sites.
 *
 * @example
 * ```ts
 * import type { ErrorSink } from "@evinvest/error-monitoring";
 *
 * function risky(sink: ErrorSink) {
 *   try {
 *     mightThrow();
 *   } catch (e) {
 *     sink.reportError(e as Error, { feature: "checkout" });
 *   }
 * }
 * ```
 */
export interface ErrorSink {
  /**
   * Report an unexpected error to the monitoring backend.
   *
   * @param error - The error to capture.
   * @param context - Optional structured context attached as `extra` data on
   *   the captured event. Omit it entirely (rather than passing `{}`) when
   *   there is nothing to attach.
   */
  reportError(error: Error, context?: Record<string, unknown>): void;
}

/**
 * The minimal structural shape this package needs from a Sentry-like SDK.
 *
 * Any object exposing `captureException` satisfies it — `@sentry/react`,
 * `@sentry/node`, and `@sentry/nextjs` all do — so {@link createSentrySink} can
 * adapt any of them without importing the SDK here.
 */
export interface SentryLike {
  /**
   * Capture an exception, optionally with a hint carrying `extra` context.
   *
   * @param error - The error to capture.
   * @param hint - Optional capture hint; this package only ever sets `extra`.
   */
  captureException(error: Error, hint?: { extra?: Record<string, unknown> }): void;
}

/**
 * Wrap a Sentry-like SDK as an {@link ErrorSink}.
 *
 * Mirrors the canonical `reportError(err, ctx)` → `captureException(err, ctx ?
 * { extra: ctx } : undefined)` mapping: when `context` is provided it is passed
 * as the hint's `extra`; when it is absent the hint is left `undefined` so the
 * SDK records no synthetic empty `extra`.
 *
 * @param sentry - Any object satisfying {@link SentryLike} (e.g. the namespace
 *   import of `@sentry/react` / `@sentry/node` / `@sentry/nextjs`).
 * @returns An {@link ErrorSink} delegating to `sentry.captureException`.
 *
 * @example
 * ```ts
 * import * as Sentry from "@sentry/node";
 * import { createSentrySink } from "@evinvest/error-monitoring";
 *
 * const sink = createSentrySink(Sentry);
 * sink.reportError(new Error("boom"), { userId: "u_1" });
 * // → Sentry.captureException(error, { extra: { userId: "u_1" } })
 * ```
 */
export function createSentrySink(sentry: SentryLike): ErrorSink {
  return {
    reportError(error: Error, context?: Record<string, unknown>): void {
      sentry.captureException(error, context ? { extra: context } : undefined);
    },
  };
}

/**
 * An {@link ErrorSink} that discards everything.
 *
 * Use as the fallback when monitoring is unconfigured (e.g. no DSN in local
 * dev) so call sites can always depend on a non-null sink.
 *
 * @returns A do-nothing {@link ErrorSink}.
 *
 * @example
 * ```ts
 * import { noopErrorSink } from "@evinvest/error-monitoring";
 * const sink = process.env.SENTRY_DSN ? realSink : noopErrorSink();
 * ```
 */
export function noopErrorSink(): ErrorSink {
  return {
    reportError(): void {
      /* no-op */
    },
  };
}

/**
 * Vendor-neutral initialisation options shared by every adapter.
 *
 * Every field is optional so an unconfigured environment (no DSN) is a valid,
 * no-op configuration. The adapters fill sensible defaults — see
 * {@link defaultTracesSampleRate} and each adapter's `@remarks`.
 *
 * @remarks
 * Read from environment variables by convention:
 * - browser (`./react`): `dsn` ← `NEXT_PUBLIC_SENTRY_DSN`, `environment` ←
 *   `NEXT_PUBLIC_APP_ENV` (default `"development"`).
 * - server / edge (`./node`, `./next`): `dsn` ← `SENTRY_DSN`, `environment` ←
 *   `APP_ENV` (default `"development"`).
 *
 * Sample rates are fractions in `[0, 1]`. Defaults: `tracesSampleRate` is `0.1`
 * in production and `1.0` elsewhere (see {@link defaultTracesSampleRate});
 * `replaysOnErrorSampleRate` is `1.0` (always record a replay on error) and
 * `replaysSessionSampleRate` is `0.05` (5% of normal sessions).
 */
export interface SentryInitOptions {
  /** Sentry DSN. When unset, `Sentry.init` is a no-op (monitoring disabled). */
  dsn?: string;
  /** Deployment environment tag, e.g. `"production"` / `"staging"`. */
  environment?: string;
  /** Fraction of transactions traced for performance, in `[0, 1]`. */
  tracesSampleRate?: number;
  /** Fraction of error sessions captured as a replay, in `[0, 1]` (browser). */
  replaysOnErrorSampleRate?: number;
  /** Fraction of normal sessions captured as a replay, in `[0, 1]` (browser). */
  replaysSessionSampleRate?: number;
}

/**
 * The default `tracesSampleRate` for a given environment.
 *
 * Returns `0.1` (10%) in production to cap transaction volume, and `1.0`
 * (100%) everywhere else so every request is visible while debugging.
 *
 * @param env - The environment name, typically `process.env.NODE_ENV`.
 * @returns `0.1` when `env === "production"`, otherwise `1.0`.
 *
 * @example
 * ```ts
 * defaultTracesSampleRate("production"); // 0.1
 * defaultTracesSampleRate("development"); // 1.0
 * defaultTracesSampleRate(undefined); // 1.0
 * ```
 */
export function defaultTracesSampleRate(env: string | undefined): number {
  return env === 'production' ? 0.1 : 1.0;
}
