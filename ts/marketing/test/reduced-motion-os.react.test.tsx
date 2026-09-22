import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { Reveal } from "../src/react/index";

// Without a <MotionConfig>, the OS preference decides. motion reads the media
// query once per module graph, which is why this lives in its own file (vitest
// isolates modules per file) and stubs matchMedia before the first render.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      // motion asks the boolean form `(prefers-reduced-motion)`, others ask `: reduce`.
      matches: /prefers-reduced-motion(\)|: *reduce)/.test(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe("prefers-reduced-motion from the OS", () => {
  it("collapses Reveal to a fade with no provider", () => {
    render(
      <Reveal onMount data-testid="r">
        hello
      </Reveal>,
    );
    const el = screen.getByTestId("r");
    expect(el.style.opacity).toBe("0");
    expect(el.style.transform).not.toMatch(/translate/);
  });
});
