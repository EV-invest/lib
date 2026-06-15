import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Avatar, AvatarImage, AvatarFallback } from "../src/components/avatar";

describe("Avatar", () => {
  it("renders the wrapper base and slot", () => {
    const { getByText } = render(<Avatar>x</Avatar>);
    const el = getByText("x");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass("rounded-full");
    expect(el).toHaveAttribute("data-slot", "avatar");
  });

  it("renders an image with the base classes", () => {
    const { container } = render(<AvatarImage src="a.png" alt="me" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveClass("aspect-square");
    expect(img).toHaveAttribute("data-slot", "avatar-image");
    expect(img).toHaveAttribute("src", "a.png");
  });

  it("hides the image when it errors", () => {
    const { container } = render(<AvatarImage src="bad.png" alt="me" />);
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders the fallback base and slot", () => {
    const { getByText } = render(<AvatarFallback>AB</AvatarFallback>);
    const el = getByText("AB");
    expect(el).toHaveClass("bg-muted");
    expect(el).toHaveAttribute("data-slot", "avatar-fallback");
  });
});
