import { render, screen } from "@testing-library/react";
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

// The first committed frame carries `initial` as an inline style; the
// animation toward `shown` only starts on the next frame. So the style right
// after render is exactly the "from" state the preference decides.
const transformOf = (el: HTMLElement) => el.style.transform;

describe("Reveal", () => {
  it("starts transparent and displaced with motion allowed", () => {
    render(
      <Full>
        <Reveal onMount data-testid="r">
          hello
        </Reveal>
      </Full>,
    );
    const el = screen.getByTestId("r");
    expect(el.style.opacity).toBe("0");
    expect(transformOf(el)).toContain("translateY(16px)");
  });

  it("collapses to a pure fade under reduced motion — transparent, not absent, not moving", () => {
    render(
      <Reduced>
        <Reveal onMount from="left" data-testid="r">
          hello
        </Reveal>
      </Reduced>,
    );
    const el = screen.getByTestId("r");
    expect(el).toHaveTextContent("hello");
    expect(el.style.opacity).toBe("0");
    expect(transformOf(el)).not.toMatch(/translate/);
  });
});

describe("StaggerItem", () => {
  it("fades without the rise under reduced motion", () => {
    render(
      <Reduced>
        <Stagger onMount>
          <StaggerItem data-testid="i">card</StaggerItem>
        </Stagger>
      </Reduced>,
    );
    const el = screen.getByTestId("i");
    expect(el.style.opacity).toBe("0");
    expect(transformOf(el)).not.toMatch(/translate/);
  });

  it("rises with motion allowed", () => {
    render(
      <Full>
        <Stagger onMount>
          <StaggerItem data-testid="i">card</StaggerItem>
        </Stagger>
      </Full>,
    );
    expect(transformOf(screen.getByTestId("i"))).toContain("translateY(16px)");
  });
});

describe("Settle", () => {
  it("renders at rest under reduced motion — its content never left", () => {
    render(
      <Reduced>
        <Settle data-testid="s">cta</Settle>
      </Reduced>,
    );
    const el = screen.getByTestId("s");
    expect(el.style.opacity).toBe("1");
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
    const root = container.querySelector("[data-motion]");
    expect(root).toHaveAttribute("data-motion", "split");
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(3);
    expect(screen.getByRole("heading")).toHaveAccessibleName("Fix it today");
  });

  it("fades the whole line as one under reduced motion", () => {
    const { container } = render(
      <Reduced>
        <h1>
          <SplitText>Fix it today</SplitText>
        </h1>
      </Reduced>,
    );
    const root = container.querySelector<HTMLElement>("[data-motion]");
    expect(root).toHaveAttribute("data-motion", "fade");
    expect(root?.style.opacity).toBe("0");
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
    expect(screen.getByRole("heading")).toHaveAccessibleName("Fix it today");
  });
});
