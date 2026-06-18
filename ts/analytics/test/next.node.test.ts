import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock `next/headers` so the server helpers run outside a request scope: the
// mock reads from a per-test cookie jar instead of a real Next request.
const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
  }),
}));

import {
  distinctIdCookieName,
  getDistinctId,
  createRequestSink,
  ANONYMOUS_DISTINCT_ID,
  type PostHogNodeLike,
} from "../src/next/index";

const KEY = "phc_test";

beforeEach(() => {
  cookieStore.clear();
});

describe("distinctIdCookieName", () => {
  it("is ph_<key>_posthog", () => {
    expect(distinctIdCookieName(KEY)).toBe("ph_phc_test_posthog");
  });
});

describe("getDistinctId", () => {
  it("reads distinct_id from the URL-encoded posthog cookie", async () => {
    cookieStore.set(
      distinctIdCookieName(KEY),
      encodeURIComponent(JSON.stringify({ distinct_id: "u_123", $sesid: 1 })),
    );
    expect(await getDistinctId(KEY)).toBe("u_123");
  });

  it("reads distinct_id from a plain (unencoded) cookie too", async () => {
    cookieStore.set(
      distinctIdCookieName(KEY),
      JSON.stringify({ distinct_id: "u_456" }),
    );
    expect(await getDistinctId(KEY)).toBe("u_456");
  });

  it("falls back to the anonymous id when the cookie is absent", async () => {
    expect(await getDistinctId(KEY)).toBe(ANONYMOUS_DISTINCT_ID);
    expect(ANONYMOUS_DISTINCT_ID).toBe("server");
  });

  it("falls back when the cookie is unparseable", async () => {
    cookieStore.set(distinctIdCookieName(KEY), "not-json");
    expect(await getDistinctId(KEY)).toBe(ANONYMOUS_DISTINCT_ID);
  });

  it("respects a custom fallback", async () => {
    expect(await getDistinctId(KEY, "anon")).toBe("anon");
  });
});

describe("createRequestSink", () => {
  it("stamps the cookie-resolved distinctId on every captured event", async () => {
    cookieStore.set(
      distinctIdCookieName(KEY),
      encodeURIComponent(JSON.stringify({ distinct_id: "u_789" })),
    );
    const captures: Array<Parameters<PostHogNodeLike["capture"]>[0]> = [];
    const client: PostHogNodeLike = {
      capture: (payload) => {
        captures.push(payload);
      },
      shutdown: () => Promise.resolve(),
    };

    const sink = await createRequestSink(client, KEY);
    sink.capture("checkout_order_placed", { amount: 42 });

    expect(captures).toEqual([
      {
        distinctId: "u_789",
        event: "checkout_order_placed",
        properties: { amount: 42 },
      },
    ]);
  });

  it("uses the anonymous id when no cookie is present", async () => {
    const captures: Array<Parameters<PostHogNodeLike["capture"]>[0]> = [];
    const client: PostHogNodeLike = {
      capture: (payload) => {
        captures.push(payload);
      },
      shutdown: () => Promise.resolve(),
    };

    const sink = await createRequestSink(client, KEY);
    sink.capture("server_event");

    expect(captures[0]?.distinctId).toBe(ANONYMOUS_DISTINCT_ID);
  });
});
