/**
 * @module @evinvest/analytics/next
 *
 * Next.js **server** helpers for analytics. Server-safe (no `"use client"`
 * banner): they use `next/headers` and run only in a Server Component, Route
 * Handler, or Server Action — never in the browser. The client-only page-view
 * tracker lives in `@evinvest/analytics/next/client`.
 *
 * The job here is attribution: a server-side event has no browser session, so it
 * must name its subject. {@link getDistinctId} reads the visitor's PostHog
 * `distinct_id` from the cookie posthog-js sets, so server events land on the
 * **same person** as the browser's; {@link createRequestSink} wraps that into a
 * request-scoped {@link AnalyticsSink} over an injected `posthog-node` client.
 */
import { cookies } from "next/headers";
import type { AnalyticsSink } from "../index";
import { createServerSink, type PostHogNodeLike } from "../node/index";

/**
 * The `distinctId` used when no PostHog cookie is present — e.g. a first-touch
 * server render before posthog-js has run on the client, or a system event with
 * no user. Mirrors the `./node` convention of naming the subject explicitly.
 */
export const ANONYMOUS_DISTINCT_ID = "server";

/**
 * The cookie posthog-js writes the visitor's identity into: `ph_<key>_posthog`,
 * holding URL-encoded JSON whose `distinct_id` field is the person id.
 *
 * @param key - The PostHog project API key (the browser key).
 * @returns The cookie name.
 */
export function distinctIdCookieName(key: string): string {
  return `ph_${key}_posthog`;
}

function parseDistinctId(raw: string): string | undefined {
  for (const candidate of [raw, decodeURIComponent(raw)]) {
    try {
      const parsed = JSON.parse(candidate) as { distinct_id?: unknown };
      if (typeof parsed.distinct_id === "string") return parsed.distinct_id;
    } catch {
      /* try the next candidate */
    }
  }
  return undefined;
}

/**
 * Read the visitor's PostHog `distinct_id` from the request cookies so a
 * server-side event attributes to the same person as their browser events.
 *
 * **Server Component / Route Handler / Server Action only** — uses `next/headers`
 * and throws on the client. Reading a cookie opts the route into dynamic
 * rendering.
 *
 * @param key      - The PostHog project API key (the browser key the cookie is
 *   named after).
 * @param fallback - Returned when the cookie is missing or unparseable. Defaults
 *   to {@link ANONYMOUS_DISTINCT_ID} (`"server"`).
 * @returns The resolved `distinct_id`, or `fallback`.
 *
 * @example
 * ```ts
 * const distinctId = await getDistinctId(process.env.NEXT_PUBLIC_POSTHOG_KEY!);
 * ```
 */
export async function getDistinctId(
  key: string,
  fallback: string = ANONYMOUS_DISTINCT_ID,
): Promise<string> {
  const jar = await cookies();
  const raw = jar.get(distinctIdCookieName(key))?.value;
  if (!raw) return fallback;
  return parseDistinctId(raw) ?? fallback;
}

/**
 * Build a request-scoped server {@link AnalyticsSink} whose `distinctId` is
 * resolved from the visitor's PostHog cookie (falling back to
 * {@link ANONYMOUS_DISTINCT_ID}), wrapping an injected `posthog-node` client.
 *
 * Use from a Route Handler or Server Action; remember to flush the client
 * (`shutdown` from `@evinvest/analytics/node`) before a short-lived process
 * exits.
 *
 * @param client   - A `posthog-node` client (or any {@link PostHogNodeLike}).
 * @param key      - The PostHog project API key the cookie is named after.
 * @param fallback - `distinctId` to use when no cookie is present.
 * @returns An {@link AnalyticsSink} that forwards to the node client, stamped
 *   with the resolved `distinctId`.
 *
 * @example
 * ```ts
 * import { PostHog } from "posthog-node";
 * import { createRequestSink, shutdown } from "@evinvest/analytics/node";
 * // ^ shutdown re-exported from ./node; createRequestSink from ./next
 *
 * const client = new PostHog(process.env.POSTHOG_KEY!);
 * const sink = await createRequestSink(client, process.env.NEXT_PUBLIC_POSTHOG_KEY!);
 * sink.capture("checkout_order_placed", { amount: 42 });
 * await shutdown(client);
 * ```
 */
export async function createRequestSink(
  client: PostHogNodeLike,
  key: string,
  fallback: string = ANONYMOUS_DISTINCT_ID,
): Promise<AnalyticsSink> {
  const distinctId = await getDistinctId(key, fallback);
  return createServerSink(client, { distinctId });
}

export { type AnalyticsSink } from "../index";
export { type PostHogNodeLike } from "../node/index";
