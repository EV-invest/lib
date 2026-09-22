/**
 * The seam every consumer codes against, split out of the entry module so the
 * transport, policy, and consent modules can depend on it without importing the
 * entry (and without an import cycle through it).
 */

/**
 * Per-call delivery hints for {@link AnalyticsSink.capture}.
 */
export interface CaptureOptions {
  /**
   * `"beacon"` asks the sink to deliver through `navigator.sendBeacon` (or a
   * `keepalive` fetch) so the event survives the page being torn down right
   * after the call — a click on a `tel:` or `wa.me` link, a form that
   * navigates. A plain request in flight at that moment is cancelled and the
   * event is lost.
   *
   * Sinks that cannot honour it deliver normally; sinks that always beacon
   * ({@link createBeaconSink}) ignore it.
   */
  transport?: "beacon";
}

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
   * @param options - Optional {@link CaptureOptions} delivery hints.
   */
  capture(
    event: string,
    props?: Record<string, unknown>,
    options?: CaptureOptions,
  ): void;
}

/**
 * The signature of {@link AnalyticsSink.capture}, exposed as a standalone type
 * so a bare capture function can be passed around (e.g. as a React context
 * value or a prop) without carrying the whole sink object.
 */
export type CaptureFn = AnalyticsSink["capture"];

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
