import { describe, it, expect, vi } from "vitest";
import {
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
