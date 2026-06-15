import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AspectRatio } from "../src/components/aspect-ratio";

describe("AspectRatio", () => {
  it("defaults the ratio to 1", () => {
    const { container } = render(<AspectRatio>x</AspectRatio>);
    const el = container.querySelector(
      '[data-slot="aspect-ratio"]',
    ) as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.aspectRatio).toBe("1");
    expect(el.textContent).toBe("x");
  });

  it("applies a custom ratio", () => {
    const { container } = render(<AspectRatio ratio={1.5}>y</AspectRatio>);
    const el = container.querySelector(
      '[data-slot="aspect-ratio"]',
    ) as HTMLElement;
    expect(el.style.aspectRatio).toBe("1.5");
  });
});
