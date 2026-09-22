import { act, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { Reveal, SplitText, Settle, Stagger, StaggerItem } from "../src/react/index";

function Reduced({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="always">{children}</MotionConfig>;
}

function Full({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="never">{children}</MotionConfig>;
}

// A few frames into a 0.45–0.7 s entrance: long enough for an instant value
// to have landed, far too short for a tweened one to have finished.
const settleFrames = () => act(() => new Promise(r => setTimeout(r, 120)));

const isMoved = (el: HTMLElement) => /translate[XY]\((?!0px\))/.test(el.style.transform);

describe("Reveal", () => {
  it("renders the same starting style whatever the preference — the server cannot know it", () => {
    const full = render(<Full><Reveal onMount data-testid="r">a</Reveal></Full>);
    const fullStyle = screen.getByTestId("r").getAttribute("style");
    full.unmount();
    render(<Reduced><Reveal onMount data-testid="r">a</Reveal></Reduced>);
    expect(screen.getByTestId("r").getAttribute("style")).toBe(fullStyle);
    expect(fullStyle).toContain("opacity: 0");
  });

  it("still travels mid-entrance with motion allowed", async () => {
    render(<Full><Reveal onMount data-testid="r">a</Reveal></Full>);
    await settleFrames();
    expect(isMoved(screen.getByTestId("r"))).toBe(true);
  });

  it("collapses to a pure fade under reduced motion — in place, still fading", async () => {
    render(
      <Reduced>
        <Reveal onMount from="left" data-testid="r">
          hello
        </Reveal>
      </Reduced>,
    );
    await settleFrames();
    const el = screen.getByTestId("r");
    expect(el).toHaveTextContent("hello");
    expect(isMoved(el)).toBe(false);
    expect(Number(el.style.opacity)).toBeLessThan(1);
  });
});

describe("StaggerItem", () => {
  it("fades without the rise under reduced motion", async () => {
    render(
      <Reduced>
        <Stagger onMount>
          <StaggerItem data-testid="i">card</StaggerItem>
        </Stagger>
      </Reduced>,
    );
    await settleFrames();
    const el = screen.getByTestId("i");
    expect(isMoved(el)).toBe(false);
    expect(Number(el.style.opacity)).toBeLessThan(1);
  });

  it("rises with motion allowed", async () => {
    render(
      <Full>
        <Stagger onMount>
          <StaggerItem data-testid="i">card</StaggerItem>
        </Stagger>
      </Full>,
    );
    await settleFrames();
    expect(isMoved(screen.getByTestId("i"))).toBe(true);
  });
});

describe("Settle", () => {
  it("snaps to rest under reduced motion — its content never left", async () => {
    render(
      <Reduced>
        <Settle data-testid="s">cta</Settle>
      </Reduced>,
    );
    await settleFrames();
    const el = screen.getByTestId("s");
    expect(el.style.opacity).toBe("1");
    expect(isMoved(el)).toBe(false);
  });
});

describe("SplitText", () => {
  it("splits into aria-hidden words plus one readable copy", () => {
    const { container } = render(
      <Full>
        <h1>
          <SplitText>
            Fix it <span className="accent">today</span>
          </SplitText>
        </h1>
      </Full>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(3);
    expect(screen.getByRole("heading")).toHaveAccessibleName("Fix it today");
  });

  it("keeps the same tree under reduced motion and lands every word in place at once", async () => {
    const { container } = render(
      <Reduced>
        <h1>
          <SplitText>Fix it today</SplitText>
        </h1>
      </Reduced>,
    );
    const words = [...container.querySelectorAll<HTMLElement>('[aria-hidden="true"]')];
    expect(words.length).toBe(3);
    expect(screen.getByRole("heading")).toHaveAccessibleName("Fix it today");
    await settleFrames();
    expect(words.some(isMoved)).toBe(false);
    // No stagger: one fade for the line, so every word is at the same point.
    expect(new Set(words.map(w => w.style.opacity)).size).toBe(1);
  });
});
