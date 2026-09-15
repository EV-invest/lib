import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Logo } from "../src/components/logo";

describe("Logo", () => {
  it("masks the consumer's token and follows the current color", () => {
    const { container } = render(<Logo className="w-10 h-10 text-white" />);
    const el = container.querySelector('[data-slot="logo"]') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.backgroundColor).toBe("currentcolor");
    expect(el.style.maskImage).toBe("var(--brand-mark)");
    expect(el).toHaveClass("w-10");
    expect(container.innerHTML).not.toContain("data:image/svg+xml");
    expect(container.querySelector('[data-slot="logo-background"]')).toBeNull();
  });

  it("seats the mark on the brand field with a background", () => {
    const { container } = render(<Logo className="w-16 h-16 rounded-md" withBackground />);
    const field = container.querySelector('[data-slot="logo-background"]') as HTMLElement;
    expect(field).toHaveClass("bg-brand");
    expect(field).toHaveClass("w-16");
    expect(container.querySelector('[data-slot="logo"]')).toHaveClass("w-3/5");
  });
});
