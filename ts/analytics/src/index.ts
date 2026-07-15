/**
 * @module @evinvest/analytics
 *
 * Vendor-neutral core for the analytics package. This entry imports **no**
 * analytics SDK, **no** React, and **no** DOM — it is safe to import from a
 * server, an edge runtime, or a worker. The PostHog instance is supplied by
 * *injection* ({@link createPostHogSink}); the React and Node entries
 * (`@evinvest/analytics/react`, `@evinvest/analytics/node`) layer the concrete
 * SDKs on top of this core.
 *
 * @remarks
 * Mirrors the `analytics` Cargo feature in `ev_lib` (`ev_lib::analytics`). The Rust
 * crate is the source of truth; this package preserves its *semantics*.
 */

/**
 * A destination that records product events. The single seam every consumer
 * codes against — UI, server handlers, and tests all depend on this interface
 * rather than on any concrete analytics vendor.
 *
 * @remarks
 * Implementations must be safe to call before they are fully wired: a sink that
 * is not yet configured (e.g. PostHog without a key) is expected to no-op
 * rather than throw. See {@link createPostHogSink} and {@link noopSink}.
 */
export interface AnalyticsSink {
  /**
   * Records a single product event.
   *
   * @param event - Snake-case event name, scoped `<surface>_<thing>_<action>`
   *   (e.g. `hero_cta_clicked`). Names are the analytics contract — renames
   *   break dashboards.
   * @param props - Optional payload of primitive values only
   *   (`string` | `number` | `boolean`). Never PII — no names, emails, or
   *   free-text the user typed.
   */
  capture(event: string, props?: Record<string, unknown>): void;
}

/**
 * The signature of {@link AnalyticsSink.capture}, exposed as a standalone type
 * so a bare capture function can be passed around (e.g. as a React context
 * value or a prop) without carrying the whole sink object.
 */
export type CaptureFn = AnalyticsSink["capture"];

/**
 * Configuration for {@link createPostHogSink}.
 *
 * @remarks
 * When `key` is absent the resulting sink silently no-ops — local development
 * and tests stay quiet without any configuration. In a browser app these
 * values typically come from `process.env.NEXT_PUBLIC_POSTHOG_KEY` and
 * `process.env.NEXT_PUBLIC_POSTHOG_HOST`; the React entry reads those for you.
 */
export interface PostHogConfig {
  /**
   * PostHog project API key. When omitted (or empty), the sink no-ops: it never
   * calls `init` and `capture` does nothing.
   */
  key?: string;
  /**
   * PostHog ingestion host. Defaults to `https://us.i.posthog.com` when omitted.
   */
  host?: string;
  /**
   * Whether PostHog should auto-capture pageviews. Defaults to `true`,
   * preserving the original site behavior.
   */
  capturePageview?: boolean;
}

/**
 * The minimal structural shape this package needs from a PostHog client. Both
 * the `posthog-js` default export and a hand-rolled stub satisfy it, which is
 * what lets the core stay SDK-free and lets tests inject a fake.
 */
export interface PostHogLike {
  /**
   * Boots the client. Called at most once by {@link createPostHogSink}.
   *
   * @param key - The PostHog project API key.
   * @param options - PostHog init options (`api_host`, `capture_pageview`,
   *   `person_profiles`, …).
   */
  init(key: string, options: Record<string, unknown>): void;
  /**
   * Forwards an event to PostHog.
   *
   * @param event - Event name.
   * @param props - Optional event properties.
   */
  capture(event: string, props?: Record<string, unknown>): void;
}

const DEFAULT_HOST = "https://us.i.posthog.com";

/**
 * Builds an {@link AnalyticsSink} backed by an injected PostHog instance.
 *
 * Vendor-neutral by construction: the instance is passed in, so this factory
 * lives in the SDK-free core. Initialization is **lazy and idempotent** — the
 * client is `init`-ed on the first `capture` that has a key, and never again.
 *
 * @param posthog - A PostHog client (the `posthog-js` default export, the
 *   result of `posthog.init` in a custom setup, or any {@link PostHogLike}
 *   stub).
 * @param config - {@link PostHogConfig} controlling key, host, and pageview
 *   capture.
 * @returns An {@link AnalyticsSink} whose `capture` forwards to PostHog.
 *
 * @remarks
 * **No-op without a key.** When `config.key` is absent, the returned sink never
 * calls `init` and every `capture` is a silent no-op — local dev and tests stay
 * quiet without configuration. `host` defaults to `https://us.i.posthog.com`
 * and `person_profiles` is fixed to `"identified_only"`.
 *
 * @example
 * ```ts
 * import posthog from "posthog-js";
 * import { createPostHogSink } from "@evinvest/analytics";
 *
 * const sink = createPostHogSink(posthog, {
 *   key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
 *   host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
 * });
 * sink.capture("hero_cta_clicked", { variant: "b" });
 * ```
 */
export function createPostHogSink(
  posthog: PostHogLike,
  config: PostHogConfig,
): AnalyticsSink {
  let initialized = false;

  const ensure = (): boolean => {
    if (initialized) return true;
    const { key } = config;
    if (!key) return false;
    posthog.init(key, {
      api_host: config.host ?? DEFAULT_HOST,
      capture_pageview: config.capturePageview ?? true,
      person_profiles: "identified_only",
    });
    initialized = true;
    return true;
  };

  return {
    capture(event, props) {
      if (!ensure()) return;
      posthog.capture(event, props);
    },
  };
}

/**
 * Returns an {@link AnalyticsSink} that discards every event.
 *
 * Use as a default when analytics is disabled, as a stand-in in tests, or as
 * the fallback a consumer reaches for when no provider is mounted.
 *
 * @returns A sink whose `capture` does nothing.
 *
 * @example
 * ```ts
 * import { noopSink } from "@evinvest/analytics";
 *
 * const sink = analyticsEnabled ? realSink : noopSink();
 * sink.capture("app_booted");
 * ```
 */
export function noopSink(): AnalyticsSink {
  return {
    capture() {},
  };
}
