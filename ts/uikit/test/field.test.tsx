import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
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
import { NativeSelect } from "../src/components/native-select";
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
    ["NativeSelect", () => <NativeSelect />, "SELECT"],
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

  it("gives no for to a label that wraps its own control, so a click on the text toggles it", () => {
    const { getByText, container } = render(
      <Field>
        <FieldLabel>
          <input type="checkbox" /> Accept
        </FieldLabel>
      </Field>,
    );
    const label = container.querySelector("label")!;
    expect(label).not.toHaveAttribute("for");
    const box = container.querySelector("input")!;
    fireEvent.click(getByText("Accept"));
    expect(box.checked).toBe(true);
  });

  it("gives no for to a label around a nested Field (the choice card)", () => {
    const { container } = render(
      <Field>
        <FieldLabel>
          <Field orientation="horizontal">
            <Checkbox /> Pro
          </Field>
        </FieldLabel>
      </Field>,
    );
    expect(container.querySelector("label")).not.toHaveAttribute("for");
  });

  it("opts out with htmlFor={null}", () => {
    const Wrapped = () => <input />;
    const { container } = render(
      <Field>
        <FieldLabel htmlFor={null}>
          <Wrapped />
        </FieldLabel>
      </Field>,
    );
    expect(container.querySelector("label")).not.toHaveAttribute("for");
  });

  it("names the id with controlId", () => {
    const { getByLabelText, getByText } = render(
      <Field controlId="email">
        <FieldLabel>Email</FieldLabel>
        <Input />
      </Field>,
    );
    expect(getByText("Email")).toHaveAttribute("for", "email");
    expect(getByLabelText("Email").id).toBe("email");
  });

  it("warns when two kit controls take the one id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Field>
        <FieldLabel>Range</FieldLabel>
        <Input />
        <Input />
      </Field>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/two controls took the same <Field> id/);
    warn.mockClear();
    render(
      <Field>
        <FieldLabel>One</FieldLabel>
        <Input />
        <Input id="other" />
      </Field>,
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("leaves a control outside any Field without an id", () => {
    const { container } = render(<Input />);
    expect(container.querySelector("input")).not.toHaveAttribute("id");
  });
});
