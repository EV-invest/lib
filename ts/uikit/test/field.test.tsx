import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
} from "../src/components/field";

describe("Field", () => {
  it("defaults to the vertical orientation", () => {
    const { getByRole } = render(<Field>x</Field>);
    const el = getByRole("group");
    expect(el).toHaveAttribute("data-orientation", "vertical");
    expect(el).toHaveClass("flex-col");
    expect(el).toHaveAttribute("data-slot", "field");
  });

  it("applies the horizontal orientation classes", () => {
    const { getByRole } = render(<Field orientation="horizontal">x</Field>);
    const el = getByRole("group");
    expect(el).toHaveAttribute("data-orientation", "horizontal");
    expect(el).toHaveClass("flex-row");
  });

  it("FieldLabel wraps the label slot with peer class", () => {
    const { getByText } = render(<FieldLabel htmlFor="n">Name</FieldLabel>);
    const el = getByText("Name");
    expect(el.tagName).toBe("LABEL");
    expect(el).toHaveClass("peer/field-label");
    expect(el).toHaveAttribute("data-slot", "field-label");
    expect(el).toHaveAttribute("for", "n");
  });

  it("FieldLegend reflects its variant", () => {
    const { getByText } = render(<FieldLegend variant="label">L</FieldLegend>);
    expect(getByText("L")).toHaveAttribute("data-variant", "label");
  });

  it("FieldError renders children with an alert role", () => {
    const { getByRole } = render(<FieldError>bad</FieldError>);
    const el = getByRole("alert");
    expect(el).toHaveClass("text-destructive");
    expect(el).toHaveTextContent("bad");
  });

  it("FieldError renders a single error message", () => {
    const { getByRole } = render(<FieldError errors={[{ message: "required" }]} />);
    expect(getByRole("alert")).toHaveTextContent("required");
  });

  it("FieldError renders nothing without content", () => {
    const { container } = render(<FieldError />);
    expect(container).toBeEmptyDOMElement();
  });

  it("FieldSeparator renders content", () => {
    const { getByText } = render(<FieldSeparator>or</FieldSeparator>);
    const el = getByText("or");
    expect(el).toHaveAttribute("data-slot", "field-separator-content");
  });

  it("renders the remaining family members with their slots", () => {
    const { container } = render(
      <FieldSet>
        <FieldGroup>
          <FieldContent>
            <FieldTitle>Title</FieldTitle>
            <FieldDescription>desc</FieldDescription>
          </FieldContent>
        </FieldGroup>
      </FieldSet>,
    );
    expect(container.querySelector('[data-slot="field-set"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="field-group"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="field-content"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="field-description"]')).toBeTruthy();
  });
});
