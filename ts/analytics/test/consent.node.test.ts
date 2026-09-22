import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createConsent,
  gatedSink,
  hasConsent,
  setConsent,
  type AnalyticsSink,
} from "../src/index";

function recorder() {
  const capture = vi.fn<AnalyticsSink["capture"]>();
  return { sink: { capture } satisfies AnalyticsSink, capture };
}

afterEach(() => {
  setConsent(false);
});

describe("gatedSink", () => {
  it("sends nothing until setConsent(true), then forwards", () => {
    const { sink, capture } = recorder();
    const gated = gatedSink(sink);
    expect(hasConsent()).toBe(false);

    gated.capture("before_consent", { a: 1 });
    expect(capture).not.toHaveBeenCalled();

    setConsent(true);
    gated.capture("after_consent", { a: 1 }, { transport: "beacon" });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(
      "after_consent",
      { a: 1 },
      { transport: "beacon" },
    );
  });

  it("drops events captured before consent instead of replaying them", () => {
    const { sink, capture } = recorder();
    const gated = gatedSink(sink);
    gated.capture("dropped");
    setConsent(true);
    expect(capture).not.toHaveBeenCalled();
  });

  it("stops forwarding once consent is withdrawn", () => {
    const { sink, capture } = recorder();
    const gated = gatedSink(sink);
    setConsent(true);
    gated.capture("one");
    setConsent(false);
    gated.capture("two");
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("reads a custom consent function instead of the page-wide flag", () => {
    const { sink, capture } = recorder();
    const ads = createConsent();
    const gated = gatedSink(sink, ads.granted);
    setConsent(true);
    gated.capture("blocked_by_ads_flag");
    expect(capture).not.toHaveBeenCalled();
    ads.set(true);
    gated.capture("sent");
    expect(capture).toHaveBeenCalledWith("sent", undefined, undefined);
  });
});
