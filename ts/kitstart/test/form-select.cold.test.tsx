import { fireEvent } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormSelectProps } from "../src/react/index";
import { freshKit, heldChunk, hydrate, landAll, mount, serverHtml, type FreshKit } from "./support/cold";

// FormSelect before its scripted list (`FormSelectKit`) is here: the native
// select is the live field, and the list is asked for on idle or at the
// visitor's reach, swapped in only once the native select has no focus.

const OPTIONS = [
  { value: "leak", label: "Fuite" },
  { value: "boiler", label: "Chaudière" },
];

function form(k: FreshKit, props: Partial<FormSelectProps> = {}): ReactElement {
  const { createElement: h } = k.React;
  const { Field, FieldLabel, FormSelect } = k.kit;
  return h("form", null, h(Field, null, h(FieldLabel, null, "Intervention"), h(FormSelect, { name: "job", options: OPTIONS, ...props })));
}

const select = (container: HTMLElement) => {
  const el = container.querySelector("select");
  if (!(el instanceof HTMLSelectElement)) throw new Error("no native select");
  return el;
};
const theForm = (container: HTMLElement) => {
  const el = container.querySelector("form");
  if (!(el instanceof HTMLFormElement)) throw new Error("no form");
  return el;
};
const trigger = (container: HTMLElement) => container.querySelector("[role=combobox]");

/** The page's idle callbacks, run by the test when it says the page is idle. */
let idle: (() => void)[] = [];
const pageIdles = () => idle.splice(0).forEach(run => run());
beforeEach(() => {
  idle = [];
  vi.stubGlobal("requestIdleCallback", (run: () => void) => idle.push(run));
  vi.stubGlobal("cancelIdleCallback", () => {});
});
// After every test's unmount (in `support/cold`), which cancels the idle callback.
afterAll(() => vi.unstubAllGlobals());
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("FormSelect before its list's chunk is here", () => {
  it("hydrates the server's native select without a mismatch, and keeps it", async () => {
    const html = await serverHtml(k => form(k, { defaultValue: "boiler" }));
    const k = await freshKit({ FormSelectKit: heldChunk() });
    const errors = vi.spyOn(console, "error");
    const page = await hydrate(k, html, form(k, { defaultValue: "boiler" }));
    expect(page.recoverable).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    expect(select(page.container).value).toBe("boiler");
    expect(trigger(page.container)).toBeNull();
  });

  it("reports a choice in the native select to onValueChange, and the form posts it", async () => {
    const k = await freshKit({ FormSelectKit: heldChunk() });
    const onValueChange = vi.fn();
    const page = await mount(k, form(k, { onValueChange }));
    await k.React.act(async () => {
      fireEvent.change(select(page.container), { target: { value: "boiler" } });
    });
    expect(onValueChange).toHaveBeenCalledWith("boiler");
    expect(new FormData(theForm(page.container)).get("job")).toBe("boiler");
  });

  it("writes a parent's value into the native select, and keeps it there against a pick the parent ignores", async () => {
    const k = await freshKit({ FormSelectKit: heldChunk() });
    const page = await mount(k, form(k, { value: "leak" }));
    await page.rerender(form(k, { value: "boiler" }));
    expect(select(page.container).value).toBe("boiler");

    await k.React.act(async () => {
      fireEvent.change(select(page.container), { target: { value: "leak" } });
    });
    expect(select(page.container).value).toBe("boiler");
  });

  it("goes back to its default on a form reset, and the list shows the default when it lands", async () => {
    const k = await freshKit({ FormSelectKit: heldChunk() });
    const page = await mount(k, form(k, { defaultValue: "leak" }));
    await k.React.act(async () => {
      fireEvent.change(select(page.container), { target: { value: "boiler" } });
    });
    await k.React.act(async () => theForm(page.container).reset());
    expect(select(page.container).value).toBe("leak");

    await landAll(k);
    expect(trigger(page.container)).toHaveTextContent("Fuite");
    expect(new FormData(theForm(page.container)).get("job")).toBe("leak");
  });
});

describe("FormSelect asking for its list", () => {
  it("asks once the page is idle, and becomes the kit's Select when the chunk lands", async () => {
    const list = heldChunk();
    const k = await freshKit({ FormSelectKit: list });
    const page = await mount(k, form(k, { defaultValue: "boiler" }));
    expect(list.asked).toBe(false);

    pageIdles();
    await vi.waitFor(() => expect(list.asked).toBe(true));

    await landAll(k);
    expect(page.container.querySelector("select")).toBeNull();
    expect(trigger(page.container)).toHaveTextContent("Chaudière");
  });

  it("asks at the focus, keeps the focused native select when the chunk lands, and swaps once the focus leaves", async () => {
    const list = heldChunk();
    const k = await freshKit({ FormSelectKit: list });
    const page = await mount(k, form(k));
    await k.React.act(async () => select(page.container).focus());
    await vi.waitFor(() => expect(list.asked).toBe(true));

    await landAll(k);
    expect(trigger(page.container)).toBeNull();
    expect(document.activeElement).toBe(select(page.container));

    await k.React.act(async () => select(page.container).blur());
    expect(page.container.querySelector("select")).toBeNull();
    expect(trigger(page.container)).toHaveTextContent("Fuite");
  });
});
