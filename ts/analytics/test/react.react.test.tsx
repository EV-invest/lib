import { describe, it, expect } from "vitest";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
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
