import type { AnalyticsSink } from "./sink";

/**
 * Anything a sink can ask "may I send?". A bare `() => boolean` is polled on
 * every capture; an object with `subscribe` additionally lets a sink react to
 * a change — {@link createPostHogSink} uses it to opt posthog-js out of its
 * own autocapture and recording when consent is withdrawn.
 */
export type ConsentSource =
  | (() => boolean)
  | {
      granted(): boolean;
      subscribe?(listener: (granted: boolean) => void): () => void;
    };

/**
 * A consent flag with a getter, a setter and change notifications — what a
 * banner writes and a {@link gatedSink} reads.
 */
export interface Consent {
  /** Whether the visitor has granted consent. */
  granted(): boolean;
  /** Records the visitor's choice; notifies subscribers when it changes. */
  set(granted: boolean): void;
  /** Calls `listener` on every change; returns the unsubscribe function. */
  subscribe(listener: (granted: boolean) => void): () => void;
}

/**
 * Creates an independent consent flag, denied until set. Use when one page
 * needs more than one flag (e.g. analytics vs. ads); otherwise the page-wide
 * {@link pageConsent} (and {@link setConsent} / {@link hasConsent}) is enough.
 */
export function createConsent(initial = false): Consent {
  let value = initial;
  const listeners = new Set<(granted: boolean) => void>();
  return {
    granted: () => value,
    set(granted) {
      if (granted === value) return;
      value = granted;
      for (const listener of [...listeners]) listener(granted);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * The page-wide consent flag that {@link setConsent} writes and
 * {@link gatedSink} reads by default. Pass it as `consent` to
 * `createPostHogSink` / `<PostHogProvider>` so withdrawal also stops
 * posthog-js's own capturing.
 */
export const pageConsent: Consent = createConsent();

/**
 * Records the visitor's choice in {@link pageConsent}. Denied until called
 * with `true`.
 */
export function setConsent(granted: boolean): void {
  pageConsent.set(granted);
}

/** Reads {@link pageConsent}. */
export function hasConsent(): boolean {
  return pageConsent.granted();
}

/** Reads a {@link ConsentSource} of either shape. */
export function readConsent(source: ConsentSource): boolean {
  return typeof source === "function" ? source() : source.granted();
}

/**
 * Wraps a sink so events reach it only while `consent` is granted.
 *
 * Events captured before consent are **dropped, not queued**: replaying them
 * after the visitor agrees would still mean they were collected before the
 * agreement.
 *
 * This gates only what goes through `capture`. Anything a vendor SDK sends by
 * itself (posthog-js autocapture, replay) is outside it — give the PostHog
 * sink the same `consent` so it can opt the SDK out.
 *
 * @param consent - Read on every capture; defaults to {@link hasConsent}.
 *
 * @example
 * ```ts
 * const sink = gatedSink(createBeaconSink({ key, region: "eu" }));
 * sink.capture("hero_cta_clicked"); // dropped
 * setConsent(true);                  // from the banner's "accept"
 * sink.capture("hero_cta_clicked"); // sent
 * ```
 */
export function gatedSink(
  sink: AnalyticsSink,
  consent: ConsentSource = hasConsent,
): AnalyticsSink {
  return {
    capture(event, props, options) {
      if (!readConsent(consent)) return;
      sink.capture(event, props, options);
    },
  };
}
