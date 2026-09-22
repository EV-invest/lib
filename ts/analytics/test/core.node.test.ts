import { describe, it, expect, vi } from "vitest";
import {
  createConsent,
  createPostHogSink,
  noopSink,
  type PostHogLike,
} from "../src/index";

function fakePostHog() {
  return {
    init: vi.fn(),
    capture: vi.fn(),
  } satisfies PostHogLike;
}

describe("createPostHogSink", () => {
  it("no-ops (never inits, never captures) when the key is absent", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, {});
    sink.capture("hero_cta_clicked", { variant: "b" });
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("no-ops when the key is the empty string", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, { key: "" });
    sink.capture("x");
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("inits lazily and exactly once across many captures (idempotent)", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, { key: "phc_test" });
    expect(ph.init).not.toHaveBeenCalled();
    sink.capture("a");
    sink.capture("b");
    sink.capture("c");
    expect(ph.init).toHaveBeenCalledTimes(1);
  });

  it("forwards (event, props) to posthog.capture", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, { key: "phc_test" });
    sink.capture("calculator_submitted", { amount: 42, ok: true });
    expect(ph.capture).toHaveBeenCalledWith("calculator_submitted", {
      amount: 42,
      ok: true,
    });
  });

  it('inits with person_profiles "identified_only" and the default host', () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, { key: "phc_test" });
    sink.capture("a");
    expect(ph.init).toHaveBeenCalledWith("phc_test", {
      api_host: "https://us.i.posthog.com",
      capture_pageview: true,
      person_profiles: "identified_only",
    });
  });

  it("honors a custom host and capturePageview override", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, {
      key: "phc_test",
      host: "https://eu.i.posthog.com",
      capturePageview: false,
    });
    sink.capture("a");
    expect(ph.init).toHaveBeenCalledWith("phc_test", {
      api_host: "https://eu.i.posthog.com",
      capture_pageview: false,
      person_profiles: "identified_only",
    });
  });

  it("forwards undefined props when no props are passed", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, { key: "phc_test" });
    sink.capture("naked_event");
    expect(ph.capture).toHaveBeenCalledWith("naked_event", undefined);
  });

  it("stays permanently disabled without a key and never retries init", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, {});
    sink.capture("a");
    sink.capture("b");
    sink.capture("c");
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("captures every event once initialized (not just the first)", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, { key: "phc_test" });
    sink.capture("a");
    sink.capture("b");
    expect(ph.capture).toHaveBeenCalledTimes(2);
    expect(ph.capture).toHaveBeenNthCalledWith(1, "a", undefined);
    expect(ph.capture).toHaveBeenNthCalledWith(2, "b", undefined);
  });

  it("defaults capturePageview to true when only a custom host is set", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, {
      key: "phc_test",
      host: "https://eu.i.posthog.com",
    });
    sink.capture("a");
    expect(ph.init).toHaveBeenCalledWith("phc_test", {
      api_host: "https://eu.i.posthog.com",
      capture_pageview: true,
      person_profiles: "identified_only",
    });
  });
});

describe("noopSink", () => {
  it("never throws and records nothing", () => {
    const sink = noopSink();
    expect(() => sink.capture("anything", { a: 1 })).not.toThrow();
  });

  it("is callable with no props", () => {
    const sink = noopSink();
    expect(() => sink.capture("bare")).not.toThrow();
  });
});

describe("createPostHogSink — cookieless mode and region", () => {
  it('inits with person_profiles "never" and in-memory persistence', () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, {
      key: "phc_test",
      cookieless: true,
      region: "eu",
    });
    sink.capture("a");
    expect(ph.init).toHaveBeenCalledWith("phc_test", {
      api_host: "https://eu.i.posthog.com",
      capture_pageview: true,
      person_profiles: "never",
      persistence: "memory",
      autocapture: false,
      rageclick: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      disable_session_recording: true,
    });
  });

  it("resolves a region to its host in the identified mode", () => {
    const ph = fakePostHog();
    createPostHogSink(ph, { key: "phc_test", region: "eu" }).capture("a");
    expect(ph.init.mock.calls[0]?.[1]).toMatchObject({
      api_host: "https://eu.i.posthog.com",
      person_profiles: "identified_only",
    });
  });

  it("prefers an explicit host over a region", () => {
    const ph = fakePostHog();
    createPostHogSink(ph, {
      key: "phc_test",
      host: "https://ph.example.com",
      region: "eu",
    }).capture("a");
    expect(ph.init.mock.calls[0]?.[1]).toMatchObject({
      api_host: "https://ph.example.com",
    });
  });

  it("keeps the US fallback for existing callers that name no target", () => {
    const ph = fakePostHog();
    createPostHogSink(ph, { key: "phc_test" }).capture("a");
    expect(ph.init.mock.calls[0]?.[1]).toMatchObject({
      api_host: "https://us.i.posthog.com",
    });
  });

  it("maps the beacon transport onto posthog-js sendBeacon", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, { key: "phc_test" });
    sink.capture(
      "contact_intent_click",
      { channel: "phone" },
      { transport: "beacon" },
    );
    expect(ph.capture).toHaveBeenCalledWith(
      "contact_intent_click",
      { channel: "phone" },
      { transport: "sendBeacon" },
    );
  });

  it("merges globalProps and enforces allowedProps", () => {
    const ph = fakePostHog();
    const sink = createPostHogSink(ph, {
      key: "phc_test",
      cookieless: true,
      region: "eu",
      allowedProps: ["brand_id", "channel"],
      globalProps: { brand_id: "aquafix" },
      strict: true,
    });
    sink.capture("contact_intent_click", { channel: "phone" });
    expect(ph.capture).toHaveBeenCalledWith("contact_intent_click", {
      brand_id: "aquafix",
      channel: "phone",
    });
    expect(() => sink.capture("e", { phone: "+33" })).toThrow();
  });

  it("does not init posthog-js before consent, then opts out and back in", () => {
    const ph = {
      ...fakePostHog(),
      opt_out_capturing: vi.fn(),
      opt_in_capturing: vi.fn(),
    } satisfies PostHogLike;
    const consent = createConsent();
    const sink = createPostHogSink(ph, {
      key: "phc_test",
      cookieless: true,
      region: "eu",
      consent,
    });

    sink.capture("before");
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();

    consent.set(true);
    sink.capture("granted");
    expect(ph.init).toHaveBeenCalledTimes(1);
    expect(ph.capture).toHaveBeenCalledTimes(1);

    consent.set(false);
    expect(ph.opt_out_capturing).toHaveBeenCalledTimes(1);
    sink.capture("withdrawn");
    expect(ph.capture).toHaveBeenCalledTimes(1);

    consent.set(true);
    expect(ph.opt_in_capturing).toHaveBeenCalledWith({
      captureEventName: false,
    });
  });

  it("gates on a bare consent function without opting the SDK out", () => {
    const ph = fakePostHog();
    let granted = false;
    const sink = createPostHogSink(ph, {
      key: "phc_test",
      consent: () => granted,
    });
    sink.capture("a");
    granted = true;
    sink.capture("b");
    expect(ph.capture).toHaveBeenCalledTimes(1);
    expect(ph.capture).toHaveBeenCalledWith("b", undefined);
  });

  it("rejects cookieless mode without a target at the type level", () => {
    const ph = fakePostHog();
    // @ts-expect-error — cookieless requires `region` or `host`.
    createPostHogSink(ph, { key: "phc_test", cookieless: true });
  });
});
