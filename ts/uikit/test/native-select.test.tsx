import * as React from "react";
import { describe, it, expect } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { NativeSelect, NativeSelectGroup, NativeSelectOption } from "../src/components/native-select";

function select(container: HTMLElement): HTMLSelectElement {
  return container.querySelector("select")!;
}

describe("NativeSelect", () => {
  it("is a platform <select> with the kit's arrow instead of the OS one", () => {
    const { container } = render(
      <NativeSelect name="city">
        <NativeSelectOption value="paris">Paris</NativeSelectOption>
      </NativeSelect>,
    );
    const el = select(container);
    expect(el).toHaveAttribute("name", "city");
    expect(el).toHaveAttribute("data-slot", "native-select");
    expect(el).toHaveClass("appearance-none");
    const wrapper = container.querySelector('[data-slot="native-select-wrapper"]')!;
    expect(wrapper.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("starts on an unpickable placeholder and styles it as one", () => {
    const { container } = render(
      <NativeSelect name="city" placeholder="Choose">
        <NativeSelectOption value="paris">Paris</NativeSelectOption>
      </NativeSelect>,
    );
    const el = select(container);
    expect(el.value).toBe("");
    const first = el.options[0]!;
    expect(first).toHaveTextContent("Choose");
    expect(first.disabled).toBe(true);
    expect(el.className).toContain("has-[option[value='']:checked]:text-ink-soft");
  });

  it("keeps a caller's default over the placeholder", () => {
    const { container } = render(
      <NativeSelect placeholder="Choose" defaultValue="lyon">
        <NativeSelectOption value="paris">Paris</NativeSelectOption>
        <NativeSelectOption value="lyon">Lyon</NativeSelectOption>
      </NativeSelect>,
    );
    expect(select(container).value).toBe("lyon");
  });

  it("is controllable like any select", () => {
    function Controlled() {
      const [v, setV] = React.useState("paris");
      return (
        <NativeSelect value={v} onChange={(e) => setV(e.target.value)}>
          <NativeSelectGroup label="France">
            <NativeSelectOption value="paris">Paris</NativeSelectOption>
            <NativeSelectOption value="lyon">Lyon</NativeSelectOption>
          </NativeSelectGroup>
        </NativeSelect>
      );
    }
    const { container } = render(<Controlled />);
    fireEvent.change(select(container), { target: { value: "lyon" } });
    expect(select(container).value).toBe("lyon");
    expect(container.querySelector("optgroup")).toHaveAttribute("label", "France");
  });

  it("takes its popup's polarity from the palette", () => {
    const { container } = render(<NativeSelect />);
    expect(select(container).className).toContain("[color-scheme:var(--scheme,normal)]");
  });

  it("splits styling between the control and the box that sizes it", () => {
    const { container } = render(<NativeSelect className="text-lg" wrapperClassName="w-full" size="sm" />);
    expect(select(container)).toHaveClass("text-lg");
    expect(select(container)).toHaveAttribute("data-size", "sm");
    expect(container.querySelector('[data-slot="native-select-wrapper"]')).toHaveClass("w-full");
  });

  it("forwards its ref to the <select>", () => {
    const ref = React.createRef<HTMLSelectElement>();
    render(<NativeSelect ref={ref} />);
    expect(ref.current?.tagName).toBe("SELECT");
  });
});
