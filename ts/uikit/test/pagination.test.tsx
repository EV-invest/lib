import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationEllipsis,
} from "../src/components/pagination";

describe("Pagination", () => {
  it("renders a labelled navigation landmark", () => {
    const { getByRole } = render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#">1</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    const nav = getByRole("navigation", { name: "pagination" });
    expect(nav).toHaveAttribute("data-slot", "pagination");
  });

  it("marks the active link with aria-current and the outline variant", () => {
    const { getByText } = render(
      <PaginationLink href="#" isActive>
        2
      </PaginationLink>,
    );
    const link = getByText("2");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("border");
  });

  it("renders the previous control with its chevron and label", () => {
    const { getByText, getByLabelText } = render(<PaginationPrevious href="#" />);
    expect(getByLabelText("Go to previous page")).toBeInTheDocument();
    expect(getByText("Previous")).toHaveClass("hidden");
  });

  it("renders an aria-hidden ellipsis", () => {
    const { getByText, container } = render(<PaginationEllipsis />);
    expect(getByText("More pages")).toHaveClass("sr-only");
    expect(
      container.querySelector("[data-slot='pagination-ellipsis']"),
    ).toHaveAttribute("aria-hidden");
  });
});
