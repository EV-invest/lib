import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

// Mock the lazily-imported browser SDK so the provider's `import("posthog-js")`
// resolves to a controllable fake — no network, no real PostHog.
const phInit = vi.fn();
const phCapture = vi.fn();
vi.mock("posthog-js", () => ({
  default: {
    init: (...args: unknown[]) => phInit(...args),
    capture: (...args: unknown[]) => phCapture(...args),
  },
}));

import {
  PostHogProvider,
  useCapture,
  useAnalytics,
} from "../src/react/index";

function render(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

// Flush the provider's async dynamic-import effect (a chain of microtasks) so the
// real sink replaces the initial no-op before assertions run.
async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  phInit.mockClear();
  phCapture.mockClear();
});

describe("PostHogProvider", () => {
  it("mounts without a key and renders children", () => {
    const { container, unmount } = render(
      <PostHogProvider>
        <span>hello</span>
      </PostHogProvider>,
    );
    expect(container.textContent).toBe("hello");
    unmount();
  });

  it("never loads posthog-js when no key is supplied", async () => {
    const { unmount } = render(
      <PostHogProvider>
        <span>x</span>
      </PostHogProvider>,
    );
    await flushEffects();
    expect(phInit).not.toHaveBeenCalled();
    expect(phCapture).not.toHaveBeenCalled();
    unmount();
  });

  it("lazily inits posthog-js and fires the initial $pageview with a key", async () => {
    const { unmount } = render(
      <PostHogProvider apiKey="phc_react">
        <span>x</span>
      </PostHogProvider>,
    );
    await flushEffects();
    expect(phInit).toHaveBeenCalledTimes(1);
    // The provider fires the initial $pageview itself, so posthog's own
    // initial-pageview autocapture is disabled to avoid double-counting.
    expect(phInit).toHaveBeenCalledWith("phc_react", {
      api_host: "https://us.i.posthog.com",
      capture_pageview: false,
      person_profiles: "identified_only",
    });
    expect(phCapture).toHaveBeenCalledWith("$pageview", undefined);
    expect(
      phCapture.mock.calls.filter(([event]) => event === "$pageview"),
    ).toHaveLength(1);
    unmount();
  });

  it("wires the explicit host through to init", async () => {
    const { unmount } = render(
      <PostHogProvider apiKey="phc_react" host="https://eu.i.posthog.com">
        <span>x</span>
      </PostHogProvider>,
    );
    await flushEffects();
    expect(phInit).toHaveBeenCalledWith("phc_react", {
      api_host: "https://eu.i.posthog.com",
      capture_pageview: false,
      person_profiles: "identified_only",
    });
    unmount();
  });

  it("buffers captures fired before posthog-js loads, then flushes them", async () => {
    // Mirrors an experiment firing `${key}_exposed` from a mount effect: the
    // child effect runs before the provider's async import resolves, so the
    // capture must be buffered and delivered once the SDK is ready.
    function Exposed() {
      const capture = useAnalytics();
      React.useEffect(() => {
        capture("hero_exposed", { variant: "b" });
      }, [capture]);
      return null;
    }
    const { unmount } = render(
      <PostHogProvider apiKey="phc_react">
        <Exposed />
      </PostHogProvider>,
    );
    await flushEffects();
    expect(phCapture).toHaveBeenCalledWith("hero_exposed", { variant: "b" });
    unmount();
  });

  it("suppresses the initial $pageview when capturePageview is false", async () => {
    function Exposed() {
      const capture = useAnalytics();
      React.useEffect(() => {
        capture("hero_exposed", { variant: "a" });
      }, [capture]);
      return null;
    }
    const { unmount } = render(
      <PostHogProvider apiKey="phc_react" capturePageview={false}>
        <Exposed />
      </PostHogProvider>,
    );
    await flushEffects();
    expect(phCapture).toHaveBeenCalledWith("hero_exposed", { variant: "a" });
    expect(
      phCapture.mock.calls.filter(([event]) => event === "$pageview"),
    ).toHaveLength(0);
    unmount();
  });

  it("forwards events from useCapture through the loaded sink", async () => {
    function CtaButton() {
      const capture = useCapture();
      return (
        <button onClick={() => capture("hero_cta_clicked", { variant: "b" })}>
          go
        </button>
      );
    }
    const { container, unmount } = render(
      <PostHogProvider apiKey="phc_react">
        <CtaButton />
      </PostHogProvider>,
    );
    await flushEffects();
    const button = container.querySelector("button")!;
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(phCapture).toHaveBeenCalledWith("hero_cta_clicked", { variant: "b" });
    unmount();
  });

  it("forwards events from useAnalytics through the loaded sink", async () => {
    function Section() {
      const capture = useAnalytics();
      return (
        <button onClick={() => capture("section_viewed", { id: "pricing" })}>
          go
        </button>
      );
    }
    const { container, unmount } = render(
      <PostHogProvider apiKey="phc_react">
        <Section />
      </PostHogProvider>,
    );
    await flushEffects();
    const button = container.querySelector("button")!;
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(phCapture).toHaveBeenCalledWith("section_viewed", { id: "pricing" });
    unmount();
  });
});

describe("useCapture", () => {
  it("throws when used outside a provider", () => {
    let captured: unknown;
    function Probe() {
      try {
        useCapture();
      } catch (err) {
        captured = err;
      }
      return null;
    }
    const { unmount } = render(<Probe />);
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toMatch(/PostHogProvider/);
    unmount();
  });
});

describe("useAnalytics", () => {
  it("no-ops silently when used outside a provider", () => {
    let threw = false;
    function Probe() {
      const capture = useAnalytics();
      try {
        capture("orphan_event", { a: 1 });
      } catch {
        threw = true;
      }
      return null;
    }
    const { unmount } = render(<Probe />);
    expect(threw).toBe(false);
    unmount();
  });
});
