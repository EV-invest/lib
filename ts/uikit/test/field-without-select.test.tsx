import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Field, FieldLabel } from "../src/components/field";
import { Input } from "../src/components/input";

// A page with a Field and an Input, and no Select anywhere: the shape that
// used to pull `select.tsx` in through field.tsx. Each test file is its own
// module graph, so this one loads exactly what such a page loads — and select
// failing to load proves it never does.
vi.mock("../src/components/select", () => {
  throw new Error("select.tsx was loaded by a page that renders no Select");
});

describe("Field with an Input and no Select in the module graph", () => {
  it("labels the Input beside the label", () => {
    const { getByLabelText } = render(
      <Field>
        <FieldLabel>Email</FieldLabel>
        <Input type="email" />
      </Field>,
    );
    const input = getByLabelText("Email");
    expect(input.tagName).toBe("INPUT");
    expect(input.id).not.toBe("");
  });

  it("still knows an Input the label wraps, without Select's module to compare against", () => {
    const { container } = render(
      <Field>
        <FieldLabel>
          <Input /> Email
        </FieldLabel>
      </Field>,
    );
    expect(container.querySelector("label")).not.toHaveAttribute("for");
  });
});
