import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "../src/components/form";

describe("Form", () => {
  it("Form is a passthrough form wrapper", () => {
    const { container } = render(<Form>body</Form>);
    const el = container.querySelector("form");
    expect(el).not.toBeNull();
    expect(el).toHaveAttribute("data-slot", "form");
    expect(el).toHaveTextContent("body");
  });

  it("FormItem shares an id so label, control and description line up", () => {
    const { getByText, getByRole } = render(
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <input />
        </FormControl>
        <FormDescription>we never share it</FormDescription>
      </FormItem>,
    );
    const label = getByText("Email");
    const input = getByRole("textbox");
    const description = getByText("we never share it");

    expect(label.tagName).toBe("LABEL");
    expect(label.getAttribute("for")).toBe(input.getAttribute("id"));
    expect(input.getAttribute("aria-describedby")).toBe(description.getAttribute("id"));
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("FormItem applies grid gap classes and slot", () => {
    const { container } = render(<FormItem>x</FormItem>);
    const el = container.querySelector('[data-slot="form-item"]');
    expect(el).toHaveClass("grid", "gap-2");
  });

  it("FormLabel toggles data-error", () => {
    const { getByText } = render(
      <FormItem>
        <FormLabel error>Email</FormLabel>
      </FormItem>,
    );
    const el = getByText("Email");
    expect(el).toHaveAttribute("data-slot", "form-label");
    expect(el).toHaveAttribute("data-error", "true");
  });

  it("FormControl marks the child invalid and lists both ids when errored", () => {
    const { getByRole } = render(
      <FormItem>
        <FormControl error>
          <input />
        </FormControl>
      </FormItem>,
    );
    const input = getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toMatch(
      /-form-item-description .*-form-item-message$/,
    );
  });

  it("FormMessage renders its children", () => {
    const { getByText } = render(
      <FormItem>
        <FormMessage>required</FormMessage>
      </FormItem>,
    );
    const el = getByText("required");
    expect(el).toHaveAttribute("data-slot", "form-message");
    expect(el).toHaveClass("text-destructive");
  });

  it("FormMessage renders nothing without children", () => {
    const { container } = render(
      <FormItem>
        <FormMessage />
      </FormItem>,
    );
    expect(container.querySelector('[data-slot="form-message"]')).toBeNull();
  });
});
