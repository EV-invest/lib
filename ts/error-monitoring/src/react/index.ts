/**
 * React client adapters: a provider that boots browser Sentry and a vendor-
 * neutral `ErrorBoundary`.
 *
 * This entry is bundled as a `"use client"` module (the tsup config adds the
 * banner) because it uses React state, effects, and the DOM — so it can be
 * imported from React Server Components / the Next.js App Router directly.
 *
 * It deliberately has no `@evinvest/uikit` / `lucide-react` dependency: the
 * fallback UI is fully caller-supplied.
 *
 * @packageDocumentation
 */
import * as React from 'react';
import { createSentrySink, noopErrorSink, defaultTracesSampleRate } from '../index.js';
import type { ErrorSink, SentryInitOptions, SentryLike } from '../index.js';

/**
 * The structural shape this module needs from a browser Sentry SDK
 * (`@sentry/react`): the {@link SentryLike} `captureException` plus `init`,
 * `addIntegration`, and `replayIntegration`.
 */
export interface BrowserSentryLike extends SentryLike {
  /** Initialise the browser SDK. */
  init(options: {
    dsn?: string | undefined;
    environment?: string | undefined;
    tracesSampleRate?: number | undefined;
    replaysOnErrorSampleRate?: number | undefined;
    replaysSessionSampleRate?: number | undefined;
  }): void;
  /** Register an extra integration after init (used for session replay). */
  addIntegration(integration: unknown): void;
  /** Build the browser-only session-replay integration. */
  replayIntegration(options?: {
    maskAllText?: boolean;
    blockAllMedia?: boolean;
  }): unknown;
}

/**
 * Props for {@link ErrorMonitoringProvider}.
 */
export interface ErrorMonitoringProviderProps {
  /**
   * An already-imported browser Sentry SDK (`@sentry/react`). When omitted, the
   * provider lazily `import("@sentry/react")` itself. Supply this to control the
   * SDK instance or to avoid the dynamic import.
   */
  sentry?: BrowserSentryLike;
  /** Init overrides; merged over the browser defaults. */
  options?: SentryInitOptions;
  /** Subtree to render. The provider renders it verbatim. */
  children?: React.ReactNode;
}

/**
 * Boots the client-side Sentry SDK once, then renders its children.
 *
 * Mount once near the root of the App Router tree. On mount it initialises the
 * browser SDK with these defaults (each overridable via `options`):
 * `dsn` ← `NEXT_PUBLIC_SENTRY_DSN`, `environment` ← `NEXT_PUBLIC_APP_ENV ??
 * "development"`, `tracesSampleRate` ← {@link defaultTracesSampleRate} of
 * `NODE_ENV` (`0.1` prod / `1.0` else), `replaysOnErrorSampleRate` `1.0`,
 * `replaysSessionSampleRate` `0.05`. The session-replay integration is added
 * only when `typeof window !== "undefined"` (it is browser-only).
 *
 * No-op when the resolved `dsn` is unset (local dev without config). Either
 * pass `sentry`, or let the provider lazily `import("@sentry/react")`.
 *
 * @param props - See {@link ErrorMonitoringProviderProps}.
 * @returns The `children` subtree (the provider itself renders no extra DOM).
 *
 * @remarks
 * Env vars: `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_APP_ENV`, `NODE_ENV`. Sample
 * rates: `tracesSampleRate` 0.1 prod / 1.0 else; replays 1.0 on error, 0.05 per
 * session. Turbopack cannot inject the client config via webpack entry points,
 * so this provider initialises explicitly.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { ErrorMonitoringProvider } from "@evinvest/error-monitoring/react";
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html><body>
 *       <ErrorMonitoringProvider>{children}</ErrorMonitoringProvider>
 *     </body></html>
 *   );
 * }
 * ```
 */
export function ErrorMonitoringProvider({
  sentry,
  options,
  children,
}: ErrorMonitoringProviderProps): React.ReactNode {
  const initialised = React.useRef(false);

  React.useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    let cancelled = false;
    const boot = (Sentry: BrowserSentryLike): void => {
      if (cancelled) return;
      Sentry.init({
        dsn: options?.dsn ?? process.env['NEXT_PUBLIC_SENTRY_DSN'],
        environment:
          options?.environment ??
          process.env['NEXT_PUBLIC_APP_ENV'] ??
          'development',
        tracesSampleRate:
          options?.tracesSampleRate ??
          defaultTracesSampleRate(process.env['NODE_ENV']),
        replaysOnErrorSampleRate: options?.replaysOnErrorSampleRate ?? 1.0,
        replaysSessionSampleRate: options?.replaysSessionSampleRate ?? 0.05,
      });
      if (typeof window !== 'undefined') {
        Sentry.addIntegration(
          Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
        );
      }
    };

    if (sentry) {
      boot(sentry);
    } else {
      void import('@sentry/react').then((m) =>
        boot(m as unknown as BrowserSentryLike),
      );
    }

    return () => {
      cancelled = true;
    };
  }, [sentry, options]);

  return children;
}

/**
 * Render-prop or static fallback rendered when a child throws.
 */
export type ErrorFallback =
  | React.ReactNode
  | ((error: Error, reset: () => void) => React.ReactNode);

/**
 * Props for {@link ErrorBoundary}.
 */
export interface ErrorBoundaryProps {
  /** Subtree to guard. */
  children: React.ReactNode;
  /**
   * UI shown after a child throws. Either a static node or a render prop
   * `(error, reset) => node`, where `reset` clears the error state and
   * re-renders `children`. Defaults to `null`.
   */
  fallback?: ErrorFallback;
  /**
   * Where to report the caught error. Provide either a ready {@link ErrorSink}
   * (via `sink`) or a {@link SentryLike} SDK (via `sentry`, wrapped with
   * {@link createSentrySink}). When neither is given, errors go to
   * {@link noopErrorSink}.
   */
  sink?: ErrorSink;
  /** A Sentry-like SDK to wrap as a sink when no explicit `sink` is given. */
  sentry?: SentryLike;
  /**
   * Extra callback invoked with the caught error and the React component stack.
   * Runs in addition to the sink report.
   */
  onError?: (error: Error, componentStack: string | null | undefined) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * A vendor-neutral React error boundary, decoupled from any design system.
 *
 * On a child throwing it: reports the error to the resolved sink (`sink`, else
 * `sentry` wrapped via {@link createSentrySink}, else {@link noopErrorSink})
 * with `{ componentStack }` as context; invokes `onError`; and renders
 * `fallback` (a node, or `(error, reset) => node`). The `reset` argument clears
 * the error and re-renders the guarded subtree.
 *
 * Bring your own fallback UI — this component ships no markup, no Tailwind, no
 * icons.
 *
 * @example
 * ```tsx
 * import { ErrorBoundary } from "@evinvest/error-monitoring/react";
 * import * as Sentry from "@sentry/react";
 *
 * <ErrorBoundary
 *   sentry={Sentry}
 *   fallback={(error, reset) => (
 *     <div role="alert">
 *       <p>{error.message}</p>
 *       <button onClick={reset}>Try again</button>
 *     </div>
 *   )}
 * >
 *   <Dashboard />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  private resolveSink(): ErrorSink {
    if (this.props.sink) return this.props.sink;
    if (this.props.sentry) return createSentrySink(this.props.sentry);
    return noopErrorSink();
  }

  override componentDidCatch(
    error: Error,
    info: React.ErrorInfo,
  ): void {
    this.resolveSink().reportError(error, {
      componentStack: info.componentStack,
    });
    this.props.onError?.(error, info.componentStack);
  }

  reset(): void {
    this.setState({ error: null });
  }

  override render(): React.ReactNode {
    const { error } = this.state;
    if (error !== null) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }
      return fallback ?? null;
    }
    return this.props.children;
  }
}
