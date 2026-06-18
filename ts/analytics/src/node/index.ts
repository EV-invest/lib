/**
 * @module @evinvest/analytics/node
 *
 * Server bindings for the analytics core. Wraps a `posthog-node` client in an
 * {@link AnalyticsSink} so server handlers record events through the same seam
 * the browser uses. No `"use client"` banner — this is server-only. Only
 * `posthog-node` *types* are referenced; the client is injected.
 */

import type { AnalyticsSink } from "../index";

/**
 * The minimal structural shape this package needs from a `posthog-node` client
 * (`new PostHog(key, options)`). Injecting it keeps this module decoupled from a
 * specific major version and lets tests pass a fake.
 */
export interface PostHogNodeLike {
  /**
   * Enqueues a server-side event.
   *
   * @param payload - The event, keyed by the resolving `distinctId`. Server
   *   events must name their subject explicitly — there is no browser session.
   */
  capture(payload: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }): void;
  /**
   * Flushes queued events and tears the client down. Await before the process
   * exits or events may be lost.
   */
  shutdown(): Promise<void>;
}

/**
 * Options for {@link createServerSink}.
 */
export interface ServerSinkConfig {
  /**
   * The `distinctId` attached to every event from this sink. Server events have
   * no browser session, so the subject must be named explicitly — e.g. a user
   * id, or a constant like `"server"` for system events.
   */
  distinctId: string;
}

/**
 * Builds an {@link AnalyticsSink} backed by an injected `posthog-node` client.
 *
 * Every {@link AnalyticsSink.capture} maps to `client.capture({ distinctId,
 * event, properties })`, stamping the configured `distinctId`. Because
 * `posthog-node` is injected and only its types are referenced here, this
 * module carries no runtime SDK dependency.
 *
 * @param client - A `posthog-node` client (or any {@link PostHogNodeLike}).
 * @param config - {@link ServerSinkConfig}; supplies the `distinctId`.
 * @returns An {@link AnalyticsSink} that forwards to the node client.
 *
 * @remarks
 * The node client does not have the browser's no-op-without-key behavior; guard
 * construction yourself (e.g. only build the client when a key is present) or
 * fall back to `noopSink()` from `@evinvest/analytics`. Always {@link shutdown}
 * the client before the process exits to flush queued events.
 *
 * @example
 * ```ts
 * import { PostHog } from "posthog-node";
 * import { createServerSink, shutdown } from "@evinvest/analytics/node";
 *
 * const client = new PostHog(process.env.POSTHOG_KEY!, {
 *   host: "https://us.i.posthog.com",
 * });
 * const sink = createServerSink(client, { distinctId: user.id });
 * sink.capture("checkout_order_placed", { amount: 42 });
 * await shutdown(client);
 * ```
 */
export function createServerSink(
  client: PostHogNodeLike,
  config: ServerSinkConfig,
): AnalyticsSink {
  return {
    capture(event, props) {
      client.capture({
        distinctId: config.distinctId,
        event,
        ...(props !== undefined ? { properties: props } : {}),
      });
    },
  };
}

/**
 * Flushes and tears down a `posthog-node` client.
 *
 * A thin, named wrapper over {@link PostHogNodeLike.shutdown} so callers depend
 * on this package's seam rather than the SDK directly. Await it before the
 * process exits or queued events may be dropped.
 *
 * @param client - The `posthog-node` client to shut down.
 * @returns A promise that resolves once the client has flushed.
 *
 * @example
 * ```ts
 * await shutdown(client);
 * ```
 */
export function shutdown(client: PostHogNodeLike): Promise<void> {
  return client.shutdown();
}

export { type AnalyticsSink } from "../index";
