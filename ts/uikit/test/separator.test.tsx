import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Separator } from "../src/components/separator";

describe("Separator", () => {
  it("renders horizontal by default", () => {
    const { getByRole } = render(<Separator />);
    const el = getByRole("separator");
    expect(el).toHaveClass("bg-border");
    expect(el).toHaveAttribute("data-orientation", "horizontal");
    expect(el).toHaveAttribute("data-slot", "separator");
    expect(el).toHaveClass("data-[orientation=horizontal]:w-full");
  });

  it("applies vertical sizing", () => {
    const { getByRole } = render(<Separator orientation="vertical" />);
    const el = getByRole("separator");
    expect(el).toHaveAttribute("data-orientation", "vertical");
    expect(el).toHaveClass("data-[orientation=vertical]:w-px");
  });

  it("lets className merge in", () => {
    const { getByRole } = render(<Separator className="my-4" />);
    expect(getByRole("separator")).toHaveClass("my-4");
  });
});
