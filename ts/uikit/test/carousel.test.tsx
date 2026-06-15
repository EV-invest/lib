import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "../src/components/carousel";

function Basic(props: { defaultIndex?: number }) {
  return (
    <Carousel {...props}>
      <CarouselContent>
        <CarouselItem>one</CarouselItem>
        <CarouselItem>two</CarouselItem>
        <CarouselItem>three</CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

describe("Carousel", () => {
  it("renders region, content and items with data-slots", () => {
    const { getByRole, getByText, container } = render(<Basic />);
    expect(getByRole("region")).toHaveAttribute(
      "aria-roledescription",
      "carousel",
    );
    expect(getByText("one")).toHaveAttribute("data-slot", "carousel-item");
    expect(getByText("one")).toHaveClass("basis-full");
    expect(
      container.querySelector('[data-slot="carousel-content"]'),
    ).toBeInTheDocument();
  });

  it("disables previous at the start and enables next", () => {
    const { getByText } = render(<Basic />);
    expect(getByText("Previous slide").closest("button")).toBeDisabled();
    expect(getByText("Next slide").closest("button")).not.toBeDisabled();
  });

  it("advances on next and translates the track", () => {
    const { getByText, container } = render(<Basic />);
    const track = container.querySelector(
      '[data-slot="carousel-content"] > div',
    ) as HTMLElement;
    expect(track.style.transform).toContain("translate3d(-0%, 0, 0)");
    fireEvent.click(getByText("Next slide").closest("button")!);
    expect(track.style.transform).toContain("translate3d(-100%, 0, 0)");
  });

  it("moves with ArrowRight / ArrowLeft on the root", () => {
    const { getByRole, container } = render(<Basic />);
    const region = getByRole("region");
    const track = container.querySelector(
      '[data-slot="carousel-content"] > div',
    ) as HTMLElement;
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(track.style.transform).toContain("translate3d(-100%, 0, 0)");
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(track.style.transform).toContain("translate3d(-0%, 0, 0)");
  });

  it("disables next at the last slide", () => {
    const { getByText } = render(<Basic defaultIndex={2} />);
    expect(getByText("Next slide").closest("button")).toBeDisabled();
    expect(getByText("Previous slide").closest("button")).not.toBeDisabled();
  });
});
