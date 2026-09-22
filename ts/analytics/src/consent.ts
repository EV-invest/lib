import type { AnalyticsSink } from "./sink";

/**
 * A consent flag with a getter and a setter — what a banner writes and a
 * {@link gatedSink} reads.
 */
export interface Consent {
  /** Whether the visitor has granted consent. */
  granted(): boolean;
  /** Records the visitor's choice. */
  set(granted: boolean): void;
}

/**
 * Creates an independent consent flag, denied until set. Use when one page
 * needs more than one flag (e.g. analytics vs. ads); otherwise the
 * module-level {@link setConsent} / {@link hasConsent} pair is enough.
 */
export function createConsent(initial = false): Consent {
  let value = initial;
  return {
    granted: () => value,
    set(granted) {
      value = granted;
    },
  };
}

const pageConsent = createConsent();

/**
 * Records the visitor's choice in the page-wide consent flag that
 * {@link gatedSink} reads by default. Denied until called with `true`.
 */
export function setConsent(granted: boolean): void {
  pageConsent.set(granted);
}

/** Reads the page-wide consent flag written by {@link setConsent}. */
export function hasConsent(): boolean {
  return pageConsent.granted();
}

/**
 * Wraps a sink so events reach it only while `consent()` returns `true`.
 *
 * Events captured before consent are **dropped, not queued**: replaying them
 * after the visitor agrees would still mean they were collected before the
 * agreement.
 *
 * @param consent - Read on every capture; defaults to {@link hasConsent}.
 *
 * @example
 * ```ts
 * const sink = gatedSink(createPostHogSink(posthog, config));
 * sink.capture("hero_cta_clicked"); // dropped
 * setConsent(true);                  // from the banner's "accept"
 * sink.capture("hero_cta_clicked"); // sent
 * ```
 */
export function gatedSink(
  sink: AnalyticsSink,
  consent: () => boolean = hasConsent,
): AnalyticsSink {
  return {
    capture(event, props, options) {
      if (!consent()) return;
      sink.capture(event, props, options);
    },
  };
}
