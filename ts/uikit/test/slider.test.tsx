import { describe, it, expect } from "vitest";
import { render, fireEvent, createEvent } from "@testing-library/react";
import { Slider } from "../src/components/slider";

describe("Slider", () => {
  it("renders slots, role and aria values", () => {
    const { getByRole, container } = render(<Slider defaultValue={25} />);
    const thumb = getByRole("slider");
    expect(container.querySelector('[data-slot="slider"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="slider-track"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="slider-range"]')).not.toBeNull();
    expect(thumb).toHaveAttribute("data-slot", "slider-thumb");
    expect(thumb).toHaveAttribute("aria-valuenow", "25");
    expect(thumb).toHaveAttribute("aria-valuemin", "0");
    expect(thumb).toHaveAttribute("aria-valuemax", "100");
    expect(thumb).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("positions range and thumb by percent", () => {
    const { getByRole, container } = render(<Slider defaultValue={25} />);
    const range = container.querySelector(
      '[data-slot="slider-range"]',
    ) as HTMLElement;
    expect(range.style.width).toBe("25%");
    expect((getByRole("slider") as HTMLElement).style.left).toBe("25%");
  });

  it("moves by step on ArrowRight / ArrowLeft", () => {
    const seen: number[] = [];
    const { getByRole } = render(
      <Slider defaultValue={50} step={10} onValueChange={(v) => seen.push(v)} />,
    );
    const thumb = getByRole("slider");
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(thumb).toHaveAttribute("aria-valuenow", "60");
    fireEvent.keyDown(thumb, { key: "ArrowLeft" });
    fireEvent.keyDown(thumb, { key: "ArrowLeft" });
    expect(thumb).toHaveAttribute("aria-valuenow", "40");
    expect(seen).toEqual([60, 50, 40]);
  });

  it("jumps to bounds on Home / End", () => {
    const { getByRole } = render(<Slider defaultValue={50} />);
    const thumb = getByRole("slider");
    fireEvent.keyDown(thumb, { key: "End" });
    expect(thumb).toHaveAttribute("aria-valuenow", "100");
    fireEvent.keyDown(thumb, { key: "Home" });
    expect(thumb).toHaveAttribute("aria-valuenow", "0");
  });

  it("computes value from pointer down on the track", () => {
    const { getByRole, container } = render(<Slider defaultValue={0} />);
    const track = container.querySelector(
      '[data-slot="slider-track"]',
    ) as HTMLElement;
    track.getBoundingClientRect = () =>
      ({ left: 0, right: 200, width: 200, top: 0, bottom: 10, height: 10 }) as DOMRect;
    // jsdom's synthetic PointerEvent drops clientX/Y from the init dict, so build
    // a MouseEvent (which jsdom honours) and tag it as a pointerdown.
    const event = createEvent.pointerDown(track, { clientX: 100, clientY: 5 });
    Object.defineProperty(event, "clientX", { value: 100 });
    Object.defineProperty(event, "clientY", { value: 5 });
    fireEvent(track, event);
    expect(getByRole("slider")).toHaveAttribute("aria-valuenow", "50");
  });

  it("stays controlled when value is provided", () => {
    const { getByRole } = render(<Slider value={30} />);
    const thumb = getByRole("slider");
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(thumb).toHaveAttribute("aria-valuenow", "30");
  });

  it("className override merges over the base", () => {
    const { container } = render(<Slider defaultValue={0} className="w-40" />);
    const root = container.querySelector('[data-slot="slider"]') as HTMLElement;
    expect(root).toHaveClass("w-40");
    expect(root).not.toHaveClass("w-full");
  });
});
