import { describe, it, expect } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "../src/components/resizable";

function Group({
  direction = "horizontal",
}: {
  direction?: "horizontal" | "vertical";
}) {
  return (
    <ResizablePanelGroup direction={direction}>
      <ResizablePanel index={0} defaultSize={30}>
        a
      </ResizablePanel>
      <ResizableHandle index={0} withHandle />
      <ResizablePanel index={1} defaultSize={70}>
        b
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

describe("Resizable", () => {
  it("renders slots and direction", () => {
    const { container } = render(<Group />);
    const group = container.querySelector(
      '[data-slot="resizable-panel-group"]',
    ) as HTMLElement;
    expect(group).toHaveAttribute("data-panel-group-direction", "horizontal");
    expect(group).toHaveClass("flex");
    expect(
      container.querySelectorAll('[data-slot="resizable-panel"]'),
    ).toHaveLength(2);
    expect(
      container.querySelector('[data-slot="resizable-handle"]'),
    ).not.toBeNull();
  });

  it("drives flex-basis from each panel's default size", () => {
    const { container } = render(<Group />);
    const panels = Array.from(
      container.querySelectorAll('[data-slot="resizable-panel"]'),
    ) as HTMLElement[];
    expect(panels[0]!.style.flex).toBe("30 1 0%");
    expect(panels[1]!.style.flex).toBe("70 1 0%");
  });

  it("exposes the handle as an oriented separator", () => {
    const { container } = render(<Group />);
    const handle = container.querySelector(
      '[data-slot="resizable-handle"]',
    ) as HTMLElement;
    expect(handle).toHaveAttribute("role", "separator");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("renders the grip svg when withHandle", () => {
    const { container } = render(<Group />);
    expect(
      container.querySelector('[data-slot="resizable-handle"] svg'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll('[data-slot="resizable-handle"] circle'),
    ).toHaveLength(6);
  });

  it("resizes adjacent panels by a step on arrow keys", () => {
    const { container } = render(<Group />);
    const handle = container.querySelector(
      '[data-slot="resizable-handle"]',
    ) as HTMLElement;
    const panels = () =>
      Array.from(
        container.querySelectorAll('[data-slot="resizable-panel"]'),
      ) as HTMLElement[];

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(panels()[0]!.style.flex).toBe("40 1 0%");
    expect(panels()[1]!.style.flex).toBe("60 1 0%");

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(panels()[0]!.style.flex).toBe("20 1 0%");
    expect(panels()[1]!.style.flex).toBe("80 1 0%");
  });

  it("ignores cross-axis arrow keys", () => {
    const { container } = render(<Group />);
    const handle = container.querySelector(
      '[data-slot="resizable-handle"]',
    ) as HTMLElement;
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    const a = container.querySelector(
      '[data-slot="resizable-panel"]',
    ) as HTMLElement;
    expect(a.style.flex).toBe("30 1 0%");
  });

  it("resizes from a pointer drag against the group size", () => {
    const { container } = render(<Group />);
    const group = container.querySelector(
      '[data-slot="resizable-panel-group"]',
    ) as HTMLElement;
    group.getBoundingClientRect = () =>
      ({ left: 0, right: 200, width: 200, top: 0, bottom: 100, height: 100 }) as DOMRect;
    const handle = container.querySelector(
      '[data-slot="resizable-handle"]',
    ) as HTMLElement;

    fireEvent.pointerDown(handle, { pointerId: 1 });
    const move = new MouseEvent("pointermove", { bubbles: true });
    Object.defineProperty(move, "movementX", { value: 20 });
    Object.defineProperty(move, "movementY", { value: 0 });
    act(() => {
      window.dispatchEvent(move);
    });
    fireEvent.pointerUp(window);

    const a = container.querySelector(
      '[data-slot="resizable-panel"]',
    ) as HTMLElement;
    // 20px of 200px wide group = +10% into the first panel.
    expect(a.style.flex).toBe("40 1 0%");
  });

  it("vertical direction flips orientation", () => {
    const { container } = render(<Group direction="vertical" />);
    expect(
      container.querySelector('[data-slot="resizable-panel-group"]'),
    ).toHaveAttribute("data-panel-group-direction", "vertical");
    expect(
      container.querySelector('[data-slot="resizable-handle"]'),
    ).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("merges a className override on the group", () => {
    const { container } = render(
      <ResizablePanelGroup className="h-40">
        <ResizablePanel index={0}>a</ResizablePanel>
      </ResizablePanelGroup>,
    );
    const group = container.querySelector(
      '[data-slot="resizable-panel-group"]',
    ) as HTMLElement;
    expect(group).toHaveClass("h-40");
    expect(group).not.toHaveClass("h-full");
  });
});
