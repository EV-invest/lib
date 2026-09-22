import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isDevelopment,
  withPropPolicy,
  type AnalyticsSink,
} from "../src/index";

function recorder() {
  const capture = vi.fn<AnalyticsSink["capture"]>();
  return { sink: { capture } satisfies AnalyticsSink, capture };
}

const allowedProps = ["brand_id", "location_id", "channel"] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDevelopment", () => {
  it("is true outside a production build", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isDevelopment()).toBe(true);
  });

  it("is false in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isDevelopment()).toBe(false);
  });
});

describe("withPropPolicy — allowedProps", () => {
  it("throws in development on a key outside the list and sends nothing", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sink, capture } = recorder();
    const guarded = withPropPolicy(sink, { allowedProps });
    expect(() =>
      guarded.capture("contact_intent_click", {
        channel: "phone",
        phone: "+48 600 000 000",
      }),
    ).toThrow(/"phone".*not in allowedProps/);
    expect(capture).not.toHaveBeenCalled();
  });

  it("drops the key silently in production and still sends the event", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { sink, capture } = recorder();
    const guarded = withPropPolicy(sink, { allowedProps });
    expect(() =>
      guarded.capture("contact_intent_click", {
        channel: "phone",
        address: "1 rue de la Paix",
      }),
    ).not.toThrow();
    expect(capture).toHaveBeenCalledWith(
      "contact_intent_click",
      { channel: "phone" },
      undefined,
    );
  });

  it("honours an explicit strict flag over NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { sink } = recorder();
    const guarded = withPropPolicy(sink, { allowedProps, strict: true });
    expect(() => guarded.capture("e", { email: "a@b.c" })).toThrow();
  });

  it("passes allowed keys and bare events through untouched", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sink, capture } = recorder();
    const guarded = withPropPolicy(sink, { allowedProps });
    guarded.capture("a", { channel: "whatsapp" }, { transport: "beacon" });
    guarded.capture("b");
    expect(capture).toHaveBeenNthCalledWith(
      1,
      "a",
      { channel: "whatsapp" },
      { transport: "beacon" },
    );
    expect(capture).toHaveBeenNthCalledWith(2, "b", undefined, undefined);
  });

  it("always allows the $-properties this package sets itself, and no others", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sink, capture } = recorder();
    const guarded = withPropPolicy(sink, { allowedProps });
    guarded.capture("$pageview", { $current_url: "https://x/", $lib: "x" });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(() => guarded.capture("e", { $ip: "1.2.3.4" })).toThrow(/"\$ip"/);
  });

  it("allows any key when no list is configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sink, capture } = recorder();
    withPropPolicy(sink, {}).capture("a", { anything: 1 });
    expect(capture).toHaveBeenCalledWith("a", { anything: 1 }, undefined);
  });
});

describe("withPropPolicy — globalProps", () => {
  it("merges globalProps into every event", () => {
    const { sink, capture } = recorder();
    const guarded = withPropPolicy(sink, {
      allowedProps,
      globalProps: { brand_id: "aquafix", location_id: "warsaw" },
    });
    guarded.capture("location_page_view");
    guarded.capture("contact_intent_click", { channel: "phone" });
    expect(capture).toHaveBeenNthCalledWith(
      1,
      "location_page_view",
      { brand_id: "aquafix", location_id: "warsaw" },
      undefined,
    );
    expect(capture).toHaveBeenNthCalledWith(
      2,
      "contact_intent_click",
      { brand_id: "aquafix", location_id: "warsaw", channel: "phone" },
      undefined,
    );
  });

  it("lets an event's own property override a global one", () => {
    const { sink, capture } = recorder();
    const guarded = withPropPolicy(sink, {
      globalProps: { location_id: "warsaw" },
    });
    guarded.capture("e", { location_id: "krakow" });
    expect(capture).toHaveBeenCalledWith(
      "e",
      { location_id: "krakow" },
      undefined,
    );
  });

  it("rejects a global outside allowedProps at construction in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sink } = recorder();
    expect(() =>
      withPropPolicy(sink, {
        allowedProps,
        globalProps: { brand_id: "aquafix", owner_phone: "+33" },
      }),
    ).toThrow(/globalProps.*"owner_phone"/);
  });

  it("strips a global outside allowedProps in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { sink, capture } = recorder();
    const guarded = withPropPolicy(sink, {
      allowedProps,
      globalProps: { brand_id: "aquafix", owner_phone: "+33" },
    });
    guarded.capture("e");
    expect(capture).toHaveBeenCalledWith(
      "e",
      { brand_id: "aquafix" },
      undefined,
    );
  });
});
