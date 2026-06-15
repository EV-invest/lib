import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "../src/components/breadcrumb";

describe("Breadcrumb", () => {
  it("renders the nav with aria-label and slot", () => {
    const { getByLabelText } = render(<Breadcrumb>x</Breadcrumb>);
    const el = getByLabelText("breadcrumb");
    expect(el.tagName).toBe("NAV");
    expect(el).toHaveAttribute("data-slot", "breadcrumb");
  });

  it("renders list, item and link slots", () => {
    const { getByText } = render(
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">home</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>,
    );
    const link = getByText("home");
    expect(link.tagName).toBe("A");
    expect(link).toHaveClass("hover:text-foreground");
    expect(link).toHaveAttribute("data-slot", "breadcrumb-link");
  });

  it("renders link as child when asChild", () => {
    const { getByRole } = render(
      <BreadcrumbLink asChild>
        <button type="button">go</button>
      </BreadcrumbLink>,
    );
    const el = getByRole("button");
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveClass("hover:text-foreground");
  });

  it("page carries aria-current", () => {
    const { getByText } = render(<BreadcrumbPage>here</BreadcrumbPage>);
    const el = getByText("here");
    expect(el).toHaveAttribute("aria-current", "page");
    expect(el).toHaveAttribute("data-slot", "breadcrumb-page");
  });

  it("separator renders a default chevron", () => {
    const { container } = render(<BreadcrumbSeparator />);
    const li = container.querySelector('[data-slot="breadcrumb-separator"]');
    expect(li?.querySelector("svg path")).toHaveAttribute("d", "m9 18 6-6-6-6");
  });

  it("ellipsis has sr-only More", () => {
    const { getByText, container } = render(<BreadcrumbEllipsis />);
    expect(getByText("More")).toHaveClass("sr-only");
    expect(
      container.querySelector('[data-slot="breadcrumb-ellipsis"] svg'),
    ).toBeTruthy();
  });
});
