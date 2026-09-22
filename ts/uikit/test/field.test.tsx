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
import { Checkbox } from "../src/components/checkbox";
import { Input } from "../src/components/input";
import { Select, SelectTrigger, SelectValue } from "../src/components/select";
import { Switch } from "../src/components/switch";
import { Textarea } from "../src/components/textarea";

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
    expect(el).toHaveClass("text-accent-error");
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

describe("Field id wiring", () => {
  it("labels its control with no id or htmlFor from the caller", () => {
    const { getByLabelText } = render(
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input />
      </Field>,
    );
    const input = getByLabelText("Name");
    expect(input.tagName).toBe("INPUT");
    expect(input.id).not.toBe("");
  });

  it.each([
    ["Textarea", () => <Textarea />, "TEXTAREA"],
    ["Checkbox", () => <Checkbox />, "BUTTON"],
    ["Switch", () => <Switch />, "BUTTON"],
    [
      "SelectTrigger",
      () => (
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
        </Select>
      ),
      "BUTTON",
    ],
  ])("hands the id to a %s", (_, control, tag) => {
    const { getByLabelText } = render(
      <Field>
        <FieldLabel>Label</FieldLabel>
        {control()}
      </Field>,
    );
    expect(getByLabelText("Label").tagName).toBe(tag);
  });

  it("gives two fields two ids", () => {
    const { getByLabelText } = render(
      <>
        <Field>
          <FieldLabel>A</FieldLabel>
          <Input />
        </Field>
        <Field>
          <FieldLabel>B</FieldLabel>
          <Input />
        </Field>
      </>,
    );
    expect(getByLabelText("A").id).not.toBe(getByLabelText("B").id);
  });

  it("keeps the caller's own id and htmlFor", () => {
    const { getByLabelText, getByText } = render(
      <Field>
        <FieldLabel htmlFor="mine">Mine</FieldLabel>
        <Input id="mine" />
      </Field>,
    );
    expect(getByText("Mine")).toHaveAttribute("for", "mine");
    expect(getByLabelText("Mine").id).toBe("mine");
  });

  it("leaves a control outside any Field without an id", () => {
    const { container } = render(<Input />);
    expect(container.querySelector("input")).not.toHaveAttribute("id");
  });
});
