/**
 * @module @evinvest/analytics/react
 *
 * React bindings for the analytics core. Ships as a `"use client"` bundle (it
 * uses hooks, context, and effects), so it can be imported from React Server
 * Components / the Next.js App Router. The PostHog browser SDK is loaded
 * **lazily** via dynamic `import("posthog-js")` inside an effect, so importing
 * this module never pulls the SDK onto the server render path.
 */

import * as React from "react";
import {
  createPostHogSink,
  noopSink,
  type AnalyticsSink,
  type CaptureFn,
} from "../index";

const AnalyticsContext = React.createContext<AnalyticsSink | null>(null);

/**
 * Props for {@link PostHogProvider}.
 *
 * @remarks
 * `apiKey` / `host` fall back to `process.env.NEXT_PUBLIC_POSTHOG_KEY` and
 * `process.env.NEXT_PUBLIC_POSTHOG_HOST` respectively. When neither a prop nor
 * the env var supplies a key, the provider mounts a no-op sink — safe in local
 * and test environments without configuration.
 */
export interface PostHogProviderProps {
  /** Children to render unchanged below the provider. */
  children?: React.ReactNode;
  /**
   * PostHog project API key. Defaults to
   * `process.env.NEXT_PUBLIC_POSTHOG_KEY`.
   */
  apiKey?: string;
  /**
   * PostHog ingestion host. Defaults to
   * `process.env.NEXT_PUBLIC_POSTHOG_HOST`, then to
   * `https://us.i.posthog.com`.
   */
  host?: string;
  /**
   * Whether PostHog should auto-capture pageviews. Defaults to `true`.
   */
  capturePageview?: boolean;
}

function readEnv(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env[name] : undefined;
}

/**
 * Boots PostHog on the client and provides an {@link AnalyticsSink} via React
 * context. Mount **once**, high in the tree (e.g. the root layout). Renders
 * `children` untouched.
 *
 * The `posthog-js` SDK is imported lazily inside `useEffect`, the sink is built
 * with {@link createPostHogSink}, and the lazy-idempotent `ensure` fires the
 * initial pageview on mount.
 *
 * @param props - {@link PostHogProviderProps}.
 * @returns The provider element wrapping `children`.
 *
 * @remarks
 * **No-op without a key.** When no key is supplied via `apiKey` or
 * `process.env.NEXT_PUBLIC_POSTHOG_KEY`, the provider serves a {@link noopSink}
 * and never loads `posthog-js`. `host` falls back to
 * `process.env.NEXT_PUBLIC_POSTHOG_HOST` then `https://us.i.posthog.com`.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { PostHogProvider } from "@evinvest/analytics/react";
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html>
 *       <body>
 *         <PostHogProvider>{children}</PostHogProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function PostHogProvider({
  children,
  apiKey,
  host,
  capturePageview,
}: PostHogProviderProps) {
  const key = apiKey ?? readEnv("NEXT_PUBLIC_POSTHOG_KEY");
  const resolvedHost = host ?? readEnv("NEXT_PUBLIC_POSTHOG_HOST");

  const sinkRef = React.useRef<AnalyticsSink>(noopSink());

  React.useEffect(() => {
    if (!key) return;
    let active = true;
    void import("posthog-js").then((mod) => {
      if (!active) return;
      const posthog = mod.default;
      const sink = createPostHogSink(posthog, {
        key,
        ...(resolvedHost !== undefined ? { host: resolvedHost } : {}),
        ...(capturePageview !== undefined ? { capturePageview } : {}),
      });
      sinkRef.current = sink;
      sink.capture("$pageview");
    });
    return () => {
      active = false;
    };
  }, [key, resolvedHost, capturePageview]);

  const value = React.useMemo<AnalyticsSink>(
    () => ({
      capture(event, props) {
        sinkRef.current.capture(event, props);
      },
    }),
    [],
  );

  return React.createElement(AnalyticsContext.Provider, { value }, children);
}

/**
 * Returns the {@link CaptureFn} from the nearest {@link PostHogProvider}.
 *
 * @returns A bound `capture(event, props?)` function.
 * @throws If called outside a {@link PostHogProvider}.
 *
 * @remarks
 * Use this when a missing provider is a programmer error you want surfaced. For
 * the lenient variant that silently no-ops without a provider, use
 * {@link capture}.
 *
 * @example
 * ```tsx
 * function CtaButton() {
 *   const capture = useCapture();
 *   return <button onClick={() => capture("hero_cta_clicked")}>Invest</button>;
 * }
 * ```
 */
export function useCapture(): CaptureFn {
  const sink = React.useContext(AnalyticsContext);
  if (!sink) {
    throw new Error("useCapture must be used within a PostHogProvider.");
  }
  return sink.capture.bind(sink);
}

/**
 * Records a product event from a component, tolerating a missing provider.
 *
 * Unlike {@link useCapture}, this is a hook that resolves the sink leniently:
 * when no {@link PostHogProvider} is mounted it returns a silent no-op,
 * preserving the original site behavior where `capture` is always safe to call.
 *
 * @returns A `capture(event, props?)` function that no-ops when no provider is
 *   mounted.
 *
 * @remarks
 * Must obey the Rules of Hooks (call at component top level), since it reads
 * context internally.
 *
 * @example
 * ```tsx
 * function Section() {
 *   const capture = useAnalytics();
 *   useEffect(() => capture("section_viewed", { id: "pricing" }), []);
 *   return null;
 * }
 * ```
 */
export function useAnalytics(): CaptureFn {
  const sink = React.useContext(AnalyticsContext);
  return React.useMemo<CaptureFn>(() => {
    const target = sink ?? noopSink();
    return (event, props) => {
      target.capture(event, props);
    };
  }, [sink]);
}

export { type AnalyticsSink, type CaptureFn } from "../index";
