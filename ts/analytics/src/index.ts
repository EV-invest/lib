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

import { withPropPolicy, type PropPolicy } from "./props";
import {
  LEGACY_DEFAULT_HOST,
  resolveHost,
  type PostHogRegion,
  type PostHogTarget,
} from "./region";
import type { AnalyticsSink } from "./sink";

export {
  noopSink,
  type AnalyticsSink,
  type CaptureFn,
  type CaptureOptions,
} from "./sink";
export {
  POSTHOG_HOSTS,
  LEGACY_DEFAULT_HOST,
  type PostHogRegion,
  type PostHogTarget,
} from "./region";
export {
  isDevelopment,
  withPropPolicy,
  type PropPolicy,
  type PropValue,
} from "./props";
export {
  createConsent,
  gatedSink,
  hasConsent,
  setConsent,
  type Consent,
} from "./consent";

/**
 * Options shared by every {@link PostHogConfig} shape.
 */
export interface PostHogBaseConfig extends PropPolicy {
  /**
   * PostHog project API key. When omitted (or empty), the sink no-ops: it never
   * calls `init` and `capture` does nothing.
   */
  key?: string | undefined;
  /**
   * Whether PostHog should auto-capture pageviews. Defaults to `true`,
   * preserving the original site behavior.
   */
  capturePageview?: boolean;
}

/**
 * The pre-existing mode: PostHog persists its id in a cookie / localStorage
 * and creates person profiles for identified users. `host` / `region` are
 * optional and fall back to {@link LEGACY_DEFAULT_HOST} (US) so the US projects
 * already on this package keep reporting where they always have.
 */
export interface IdentifiedMode {
  cookieless?: false;
  /** Ingestion host; wins over `region`. */
  host?: string | undefined;
  /** PostHog Cloud region, used when `host` is absent. */
  region?: PostHogRegion | undefined;
}

/**
 * Cookieless mode: `persistence: "memory"` (nothing written to cookies or
 * storage; a reload is a new visitor) and `person_profiles: "never"`. The
 * target is required — a new mode has no legacy region to inherit.
 */
export type CookielessMode = { cookieless: true } & PostHogTarget;

/**
 * Configuration for {@link createPostHogSink}.
 *
 * @remarks
 * When `key` is absent the resulting sink silently no-ops — local development
 * and tests stay quiet without any configuration. `allowedProps` /
 * `globalProps` ({@link PropPolicy}) are enforced even then, so a disallowed
 * key still fails in development without a PostHog key.
 */
export type PostHogConfig = PostHogBaseConfig &
  (IdentifiedMode | CookielessMode);

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
   *   `person_profiles`, `persistence`, …).
   */
  init(key: string, options: Record<string, unknown>): void;
  /**
   * Forwards an event to PostHog.
   *
   * @param event - Event name.
   * @param props - Optional event properties.
   * @param options - posthog-js capture options; only `transport` is used.
   */
  capture(
    event: string,
    props?: Record<string, unknown>,
    options?: { transport?: "sendBeacon" },
  ): void;
}

function initOptions(config: PostHogConfig): Record<string, unknown> {
  const base = {
    api_host: resolveHost(config, LEGACY_DEFAULT_HOST),
    capture_pageview: config.capturePageview ?? true,
  };
  return config.cookieless
    ? { ...base, person_profiles: "never", persistence: "memory" }
    : { ...base, person_profiles: "identified_only" };
}

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
 * @param config - {@link PostHogConfig}: key, target, mode, pageview capture,
 *   and the property policy.
 * @returns An {@link AnalyticsSink} whose `capture` forwards to PostHog.
 *
 * @remarks
 * **No-op without a key.** When `config.key` is absent, the returned sink never
 * calls `init` and every `capture` is a silent no-op — local dev and tests stay
 * quiet without configuration.
 *
 * **Target.** `host` wins, then `region`; the identified (default) mode falls
 * back to `https://us.i.posthog.com`, cookieless mode requires one of the two.
 *
 * **Beacon.** `capture(event, props, { transport: "beacon" })` maps to
 * posthog-js's `sendBeacon` transport, for events followed by navigation.
 *
 * @example
 * ```ts
 * import posthog from "posthog-js";
 * import { createPostHogSink } from "@evinvest/analytics";
 *
 * const sink = createPostHogSink(posthog, {
 *   key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
 *   cookieless: true,
 *   region: "eu",
 *   allowedProps: ["brand_id", "location_id", "channel"],
 *   globalProps: { brand_id: "aquafix" },
 * });
 * sink.capture("contact_intent_click", { channel: "phone" }, { transport: "beacon" });
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
    posthog.init(key, initOptions(config));
    initialized = true;
    return true;
  };

  const inner: AnalyticsSink = {
    capture(event, props, options) {
      if (!ensure()) return;
      if (options?.transport === "beacon") {
        posthog.capture(event, props, { transport: "sendBeacon" });
      } else {
        posthog.capture(event, props);
      }
    },
  };
  return withPropPolicy(inner, config);
}
