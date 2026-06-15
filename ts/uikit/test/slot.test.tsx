import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Slot } from "../src/primitives/slot";

describe("Slot", () => {
  it("merges className onto the single child", () => {
    const { getByText } = render(
      <Slot className="px-4">
        <a className="text-primary">link</a>
      </Slot>,
    );
    const el = getByText("link");
    expect(el.tagName).toBe("A");
    expect(el).toHaveClass("px-4", "text-primary");
  });

  it("chains event handlers, child first", () => {
    const order: string[] = [];
    const { getByText } = render(
      <Slot onClick={() => order.push("slot")}>
        <button onClick={() => order.push("child")}>go</button>
      </Slot>,
    );
    getByText("go").click();
    expect(order).toEqual(["child", "slot"]);
  });

  it("renders nothing for a non-element child", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<Slot>plain text</Slot>);
    expect(container).toBeEmptyDOMElement();
    spy.mockRestore();
  });
});
