import * as React from "react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "../src/components/button";
import { Field, FieldLabel } from "../src/components/field";
import { FormControl, FormItem, FormLabel } from "../src/components/form";
import { Input } from "../src/components/input";
import { NativeSelect, NativeSelectOption } from "../src/components/native-select";

// The form a landing page ships: it has to submit before the bundle arrives and
// keep its label wiring through hydration. Nothing here is mocked — the server
// string is what a browser with scripting off would get.
function LandingForm() {
  return (
    <form action="/lead" method="post">
      <Field>
        <FieldLabel>Service</FieldLabel>
        <NativeSelect name="service" placeholder="Pick one" required>
          <NativeSelectOption value="leak">Leak</NativeSelectOption>
          <NativeSelectOption value="boiler">Boiler</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel>Phone</FieldLabel>
        <Input name="phone" type="tel" defaultValue="+33 1 23 45 67 89" />
      </Field>
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input name="email" type="email" />
        </FormControl>
      </FormItem>
      <Button type="submit">Send</Button>
    </form>
  );
}

function Page() {
  return (
    <main>
      <LandingForm />
    </main>
  );
}

function parse(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

function labelled(host: HTMLElement): Array<[string, Element | null]> {
  return [...host.querySelectorAll("label")].map((label) => {
    const target = label.getAttribute("for") ?? "";
    return [target, target ? document.getElementById(target) : null];
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("a landing form", () => {
  it("renders a real <select name> with its options on the server", () => {
    const host = parse(renderToString(<Page />));
    const select = host.querySelector("select");
    expect(select).not.toBeNull();
    expect(select).toHaveAttribute("name", "service");
    expect([...select!.querySelectorAll("option")].map((o) => o.value)).toEqual(["", "leak", "boiler"]);
    expect(select!.value).toBe("");
  });

  it("submits the chosen option with scripting off (server markup, never hydrated)", () => {
    const host = parse(renderToString(<Page />));
    const form = host.querySelector("form")!;
    const select = form.querySelector("select")!;
    select.value = "boiler";
    const data = new FormData(form);
    expect(data.get("service")).toBe("boiler");
    expect(data.get("phone")).toBe("+33 1 23 45 67 89");
  });

  it("points every label at a control on the server markup", () => {
    const host = parse(renderToString(<Page />));
    const pairs = labelled(host);
    expect(pairs).toHaveLength(3);
    for (const [target, control] of pairs) {
      expect(target).not.toBe("");
      expect(control).not.toBeNull();
      expect(["SELECT", "INPUT"]).toContain(control!.tagName);
    }
  });

  it("hydrates with the same ids and no mismatch", async () => {
    // A long-lived server has rendered this page before; an id minted from a
    // module counter would have moved on, while the fresh client starts over.
    renderToString(<Page />);
    const html = renderToString(<Page />);
    const host = parse(html);
    const before = labelled(host).map(([id]) => id);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable = vi.fn();
    await act(async () => {
      hydrateRoot(host, <Page />, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(labelled(host).map(([id]) => id)).toEqual(before);
    for (const [, control] of labelled(host)) expect(control).not.toBeNull();
  });

  it("is keyboard-reachable in source order: select, input, input, submit", () => {
    const host = parse(renderToString(<Page />));
    const focusable = [...host.querySelectorAll<HTMLElement>("select, input, button, a[href], [tabindex]")].filter(
      (el) => el.tabIndex >= 0 && !el.hasAttribute("disabled"),
    );
    expect(focusable.map((el) => el.tagName)).toEqual(["SELECT", "INPUT", "INPUT", "BUTTON"]);
    expect(focusable.at(-1)).toHaveAttribute("type", "submit");
  });
});
