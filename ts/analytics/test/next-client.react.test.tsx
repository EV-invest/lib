import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

// Controllable fake browser SDK (same approach as react.react.test.tsx).
const phInit = vi.fn();
const phCapture = vi.fn();
vi.mock("posthog-js", () => ({
  default: {
    init: (...args: unknown[]) => phInit(...args),
    capture: (...args: unknown[]) => phCapture(...args),
  },
}));

// Mock next/navigation; `mockPathname` is mutable so a re-render simulates a
// soft navigation.
let mockPathname = "/";
const mockSearch = new URLSearchParams();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearch,
}));

import { PostHogProvider } from "../src/react/index";
import { PostHogPageView } from "../src/next/client";

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return {
    rerender: (n: React.ReactNode) =>
      act(() => {
        root.render(n);
      }),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const pageviews = () =>
  phCapture.mock.calls.filter(([event]) => event === "$pageview");

beforeEach(() => {
  phInit.mockClear();
  phCapture.mockClear();
  mockPathname = "/";
});

// The provider owns no initial pageview here (capturePageview={false}); the
// tracker owns them all — the documented composition.
function tree() {
  return (
    <PostHogProvider apiKey="phc_react" capturePageview={false}>
      <PostHogPageView />
    </PostHogProvider>
  );
}

describe("PostHogPageView", () => {
  it("fires exactly one $pageview on mount, buffered until the SDK loads", async () => {
    const { unmount } = mount(tree());
    await flushEffects();
    expect(pageviews()).toHaveLength(1);
    expect(phCapture).toHaveBeenCalledWith(
      "$pageview",
      expect.objectContaining({ $current_url: expect.any(String) }),
    );
    unmount();
  });

  it("re-fires $pageview on a soft navigation (pathname change)", async () => {
    const { rerender, unmount } = mount(tree());
    await flushEffects();
    expect(pageviews()).toHaveLength(1);

    mockPathname = "/about";
    rerender(tree());
    await flushEffects();
    expect(pageviews()).toHaveLength(2);
    unmount();
  });

  it("no-ops (and never throws) without a provider", async () => {
    let threw = false;
    let cleanup = () => {};
    try {
      const { unmount } = mount(<PostHogPageView />);
      cleanup = unmount;
      await flushEffects();
    } catch {
      threw = true;
    }
    cleanup();
    expect(threw).toBe(false);
    expect(phCapture).not.toHaveBeenCalled();
  });
});
