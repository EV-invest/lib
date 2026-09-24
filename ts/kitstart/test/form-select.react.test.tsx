import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field, FieldLabel, FormSelect, type FormSelectProps } from "../src/react/index";

const OPTIONS = [
  { value: "leak", label: "Fuite" },
  { value: "boiler", label: "Chaudière" },
];

function form(props: Partial<FormSelectProps> = {}): ReactElement {
  return (
    <form>
      <Field className="flex flex-col gap-2">
        <FieldLabel>Intervention</FieldLabel>
        <FormSelect name="job" options={OPTIONS} size="lg" {...props} />
      </Field>
    </form>
  );
}

function theForm(): HTMLFormElement {
  const el = document.querySelector("form");
  if (!(el instanceof HTMLFormElement)) throw new Error("no form");
  return el;
}

const mounted: HTMLElement[] = [];
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
});

/** The server's HTML in the document, then React hydrating it — the page as a visitor gets it. */
async function hydrate(node: ReactElement, beforeHydration: (root: HTMLElement) => void = () => {}) {
  const root = document.createElement("div");
  root.innerHTML = renderToString(node);
  document.body.append(root);
  mounted.push(root);
  beforeHydration(root);
  await act(async () => {
    hydrateRoot(root, node);
  });
  return root;
}

describe("FormSelect on the server and without JavaScript", () => {
  it("is a native <select name> the form posts, labelled by its Field", () => {
    const root = document.createElement("div");
    root.innerHTML = renderToString(form({ defaultValue: "boiler" }));
    const select = root.querySelector("select");
    expect(select).toHaveAttribute("name", "job");
    expect(select).toHaveAttribute("data-size", "lg");
    expect(root.querySelector("label")?.getAttribute("for")).toBe(select?.id);
    expect(root.querySelector("[role=combobox]")).toBeNull();
    expect(new FormData(root.querySelector("form") ?? undefined).get("job")).toBe("boiler");
  });

  it("keeps required and the placeholder on the native control", () => {
    const root = document.createElement("div");
    root.innerHTML = renderToString(form({ required: true, placeholder: "Choisir" }));
    const select = root.querySelector("select");
    expect(select).toBeRequired();
    expect(select?.value).toBe("");
    expect(select?.checkValidity()).toBe(false);
  });
});

describe("FormSelect after hydration", () => {
  it("becomes the kit's Select, with the value in an input of the same name", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await hydrate(form({ defaultValue: "boiler" }));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    expect(document.querySelector("select")).toBeNull();
    const trigger = screen.getByRole("combobox", { name: "Intervention" });
    expect(trigger).toHaveTextContent("Chaudière");
    const hidden = document.querySelector("input[name=job]");
    expect(hidden).toHaveAttribute("type", "hidden");
    expect(hidden).toHaveValue("boiler");
    expect(new FormData(theForm()).get("job")).toBe("boiler");
  });

  it("keeps a choice made in the native select before the script arrived", async () => {
    await hydrate(form(), root => {
      const select = root.querySelector("select");
      if (select) select.value = "boiler";
    });
    expect(new FormData(theForm()).get("job")).toBe("boiler");
    expect(screen.getByRole("combobox")).toHaveTextContent("Chaudière");
  });

  it("posts the option chosen in the list", () => {
    const onValueChange = vi.fn();
    render(form({ onValueChange }));
    expect(new FormData(theForm()).get("job")).toBe("leak");
    fireEvent.click(screen.getByRole("combobox", { name: "Intervention" }));
    fireEvent.click(screen.getByRole("option", { name: "Chaudière" }));
    expect(new FormData(theForm()).get("job")).toBe("boiler");
    expect(onValueChange).toHaveBeenCalledWith("boiler");
  });

  it("puts the default back on a form reset", () => {
    render(form({ defaultValue: "leak" }));
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Chaudière" }));
    act(() => theForm().reset());
    expect(new FormData(theForm()).get("job")).toBe("leak");
    expect(screen.getByRole("combobox")).toHaveTextContent("Fuite");
  });

  it("still refuses a required form with nothing chosen, and points at the field", () => {
    render(form({ required: true, placeholder: "Choisir" }));
    const trigger = screen.getByRole("combobox", { name: "Intervention" });
    expect(trigger).toHaveAttribute("aria-required", "true");
    expect(trigger).toHaveTextContent("Choisir");
    expect(trigger.querySelector("[data-placeholder]")).toHaveTextContent("Choisir");
    let valid = true;
    act(() => {
      valid = theForm().checkValidity();
    });
    expect(valid).toBe(false);
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Fuite" }));
    expect(trigger).not.toHaveAttribute("aria-invalid");
    expect(trigger.querySelector("[data-placeholder]")).toBeNull();
    expect(theForm().checkValidity()).toBe(true);
    expect(new FormData(theForm()).get("job")).toBe("leak");
  });

  it("keeps the validated input out of the tab order and the accessibility tree", () => {
    render(form({ required: true, placeholder: "Choisir" }));
    const input = document.querySelector("input[name=job]");
    expect(input).toHaveAttribute("tabindex", "-1");
    expect(input).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("posts nothing while disabled, as a disabled select would", () => {
    render(form({ disabled: true }));
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(new FormData(theForm()).get("job")).toBeNull();
  });
});
