import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Kbd, KbdGroup } from "../src/components/kbd";

describe("Kbd", () => {
  it("renders the base and slot", () => {
    const { getByText } = render(<Kbd>K</Kbd>);
    const el = getByText("K");
    expect(el.tagName).toBe("KBD");
    expect(el).toHaveClass("bg-muted");
    expect(el).toHaveAttribute("data-slot", "kbd");
  });

  it("renders a group slot", () => {
    const { container } = render(
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
      </KbdGroup>,
    );
    const group = container.querySelector('[data-slot="kbd-group"]');
    expect(group).toHaveClass("inline-flex", "items-center", "gap-1");
  });

  it("lets className override", () => {
    const { getByText } = render(<Kbd className="px-4">x</Kbd>);
    const el = getByText("x");
    expect(el).toHaveClass("px-4");
    expect(el).not.toHaveClass("px-1");
  });
});
