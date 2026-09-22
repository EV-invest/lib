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
  gatedSink,
  noopSink,
  readConsent,
  withPropPolicy,
  type AnalyticsSink,
  type CaptureFn,
  type CaptureOptions,
  type ConsentSource,
  type PostHogRegion,
  type PostHogTarget,
  type PropPolicy,
} from "../index";
// Shared with `./next/client`'s PostHogPageView so both read the same context.
import { AnalyticsContext } from "./context";

/**
 * Props every {@link PostHogProvider} accepts, whatever the mode.
 */
export interface PostHogProviderBaseProps extends PropPolicy {
  /** Children to render unchanged below the provider. */
  children?: React.ReactNode;
  /**
   * PostHog project API key. Defaults to
   * `process.env.NEXT_PUBLIC_POSTHOG_KEY`.
   */
  apiKey?: string;
  /**
   * Whether PostHog should auto-capture pageviews. Defaults to `true`.
   */
  capturePageview?: boolean;
  /**
   * When given, events (the initial pageview included) are sent only while it
   * is granted; see `gatedSink`. Pass `pageConsent` imported from
   * `@evinvest/analytics` — it can `subscribe`, so a withdrawal also opts
   * posthog-js out of its own capturing — and import it from the core entry:
   * this entry is a separate bundle whose own copy of the page-wide flag would
   * never see a `setConsent`. Read through a ref, so an inline function does
   * not rebuild the context value on every render.
   */
  consent?: ConsentSource;
}

/**
 * Props for {@link PostHogProvider}.
 *
 * @remarks
 * `apiKey` falls back to `process.env.NEXT_PUBLIC_POSTHOG_KEY`. In the default
 * (identified) mode `host` falls back to `process.env.NEXT_PUBLIC_POSTHOG_HOST`,
 * then `region`, then `https://us.i.posthog.com`. `cookieless` requires an
 * explicit `region` or `host`. When no key is supplied, the provider mounts a
 * no-op sink — safe in local and test environments without configuration.
 */
export type PostHogProviderProps = PostHogProviderBaseProps &
  (
    | {
        cookieless?: false;
        /**
         * PostHog ingestion host. Defaults to
         * `process.env.NEXT_PUBLIC_POSTHOG_HOST`, then to `region`, then to
         * `https://us.i.posthog.com`.
         */
        host?: string;
        /** PostHog Cloud region, used when no host is resolved. */
        region?: PostHogRegion;
      }
    | ({ cookieless: true } & PostHogTarget)
  );

function readEnv(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env[name] : undefined;
}

type Buffered = {
  event: string;
  props?: Record<string, unknown> | undefined;
  options?: CaptureOptions | undefined;
};

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
 * and never loads `posthog-js`. `allowedProps` / `globalProps` still apply, so
 * a disallowed key fails in development without a key.
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
export function PostHogProvider(props: PostHogProviderProps) {
  const { children, apiKey, capturePageview, consent } = props;
  const { allowedProps, globalProps, strict } = props;
  const key = apiKey ?? readEnv("NEXT_PUBLIC_POSTHOG_KEY");
  const cookieless = props.cookieless === true;
  const host = cookieless
    ? props.host
    : (props.host ?? readEnv("NEXT_PUBLIC_POSTHOG_HOST"));
  const region = props.region;

  const sinkRef = React.useRef<AnalyticsSink>(noopSink());
  // `posthog-js` loads asynchronously (dynamic import below), but consumers can
  // `capture` on first paint — e.g. an experiment firing `${key}_exposed` from a
  // mount effect, which runs before this provider's effect resolves the import.
  // Such captures are buffered until the SDK is ready, then flushed in order, so
  // first-load events are never silently dropped.
  const readyRef = React.useRef(false);
  const bufferRef = React.useRef<Buffered[]>([]);
  const enabled = Boolean(key);

  const raw = React.useMemo<AnalyticsSink>(
    () => ({
      capture(event, eventProps, options) {
        if (readyRef.current) {
          sinkRef.current.capture(event, eventProps, options);
        } else if (enabled) {
          // SDK still loading — buffer for flush on init. When analytics is
          // disabled (no key), this is a silent no-op, as before.
          bufferRef.current.push({ event, props: eventProps, options });
        }
      },
    }),
    [enabled],
  );

  // Policy and consent wrap the context value rather than the PostHog sink, so
  // they apply to buffered events and to the initial pageview alike, and a
  // misconfigured `globalProps` fails during render in development instead of
  // inside an unobserved promise.
  const consentRef = React.useRef(consent);
  consentRef.current = consent;
  const gated = consent !== undefined;
  // One stable source over the ref: a new `consent` identity each render must
  // not change the context value, or every consumer effect (the App Router
  // page-view tracker among them) re-fires.
  const consentSource = React.useMemo<ConsentSource>(
    () => ({
      granted() {
        const current = consentRef.current;
        return current === undefined || readConsent(current);
      },
      subscribe(listener) {
        const current = consentRef.current;
        return typeof current === "object" && current.subscribe
          ? current.subscribe(listener)
          : () => {};
      },
    }),
    [],
  );

  const policyKey = JSON.stringify([allowedProps, globalProps, strict]);
  const value = React.useMemo<AnalyticsSink>(() => {
    const inner = gated ? gatedSink(raw, consentSource) : raw;
    return withPropPolicy(inner, {
      ...(allowedProps !== undefined ? { allowedProps } : {}),
      ...(globalProps !== undefined ? { globalProps } : {}),
      ...(strict !== undefined ? { strict } : {}),
    });
    // `policyKey` stands in for the policy fields so an inline array literal
    // does not rebuild the sink on every render.
  }, [raw, gated, consentSource, policyKey]);
  const valueRef = React.useRef(value);
  valueRef.current = value;

  React.useEffect(() => {
    if (!key) return;
    let active = true;
    void import("posthog-js").then((mod) => {
      if (!active) return;
      const target = cookieless
        ? host
          ? { cookieless: true as const, host }
          : region
            ? { cookieless: true as const, region }
            : undefined
        : {
            ...(host !== undefined ? { host } : {}),
            ...(region !== undefined ? { region } : {}),
          };
      // Unreachable through the prop types; a JS caller gets a no-op rather
      // than events in an unintended region.
      if (!target) return;
      sinkRef.current = createPostHogSink(mod.default, {
        key,
        ...target,
        // The provider fires the single initial $pageview itself (below), so
        // posthog's own initial-pageview autocapture is disabled to avoid
        // double-counting it.
        capturePageview: false,
        ...(gated ? { consent: consentSource } : {}),
      });
      readyRef.current = true;
      // Fire exactly one initial pageview unless the caller opted out. This is
      // also what lazily inits posthog, so a pageview is guaranteed on mount.
      if (capturePageview !== false) valueRef.current.capture("$pageview");
      // Flush captures that arrived while posthog-js was still loading. They
      // already passed the policy and consent checks when captured.
      const queued = bufferRef.current;
      bufferRef.current = [];
      for (const item of queued) {
        sinkRef.current.capture(item.event, item.props, item.options);
      }
    });
    return () => {
      active = false;
    };
  }, [key, host, region, cookieless, capturePageview, gated, consentSource]);

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
    return (event, props, options) => {
      target.capture(event, props, options);
    };
  }, [sink]);
}

export { type AnalyticsSink, type CaptureFn } from "../index";
