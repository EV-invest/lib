import * as React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { focusCandidates, useFocusScope, type InitialFocus } from "../src/primitives/focus-scope";

describe("focusCandidates", () => {
  it("lists enabled controls in DOM order and skips tabindex=-1 on any tag", () => {
    const root = document.createElement("div");
    root.innerHTML = [
      '<a href="#" id="link">a</a>',
      '<a href="#" tabindex="-1">parked link</a>',
      '<button id="btn">b</button>',
      '<button tabindex="-1">parked button</button>',
      "<button disabled>disabled</button>",
      '<input id="input">',
      '<input tabindex="-1">',
      '<div tabindex="0" id="div">d</div>',
      '<div tabindex="-1">parked div</div>',
      "<span>text</span>",
    ].join("");
    document.body.appendChild(root);
    try {
      expect(focusCandidates(root).map(el => el.id)).toEqual(["link", "btn", "input", "div"]);
    } finally {
      root.remove();
    }
  });
});

function Scope({
  initialFocus,
  rootTabIndex,
  returnFocusTo,
  enabled = true,
  children,
}: {
  initialFocus?: InitialFocus;
  rootTabIndex?: number;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
  children?: React.ReactNode;
}) {
  const ref = useFocusScope(enabled, {
    ...(initialFocus ? { initialFocus } : {}),
    ...(returnFocusTo ? { returnFocusTo } : {}),
  });
  return (
    <div ref={ref} data-testid="scope" tabIndex={rootTabIndex}>
      {children}
    </div>
  );
}

describe("useFocusScope", () => {
  // jsdom lays nothing out, so every element measures 0×0 and the visibility
  // filter would drop them all; give them a box to count as Tab stops.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(10);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("focuses the root itself when nothing inside is focusable, making it focusable first", () => {
    const { getByTestId } = render(
      <Scope>
        <p>text only</p>
      </Scope>,
    );
    const root = getByTestId("scope");
    expect(root).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(root);
  });

  it("focuses the first Tab stop by default and leaves the root alone", () => {
    const { getByTestId, getByText } = render(
      <Scope>
        <button type="button">first</button>
        <button type="button">second</button>
      </Scope>,
    );
    expect(document.activeElement).toBe(getByText("first"));
    expect(getByTestId("scope")).not.toHaveAttribute("tabindex");
  });

  it("container mode focuses the root even with controls inside", () => {
    const { getByTestId } = render(
      <Scope initialFocus="container">
        <button type="button">first</button>
      </Scope>,
    );
    const root = getByTestId("scope");
    expect(document.activeElement).toBe(root);
    expect(root).toHaveAttribute("tabindex", "-1");
  });

  it("keeps a tabindex the caller set on the root", () => {
    const { getByTestId } = render(<Scope initialFocus="container" rootTabIndex={0} />);
    expect(getByTestId("scope")).toHaveAttribute("tabindex", "0");
    expect(document.activeElement).toBe(getByTestId("scope"));
  });

  it("from the root, Tab enters at the first control and Shift+Tab wraps to the last", () => {
    const { getByTestId, getByText } = render(
      <Scope initialFocus="container">
        <button type="button">first</button>
        <button type="button">last</button>
      </Scope>,
    );
    const root = getByTestId("scope");
    fireEvent.keyDown(root, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(getByText("last"));

    root.focus();
    fireEvent.keyDown(root, { key: "Tab" });
    expect(document.activeElement).toBe(getByText("first"));
  });

  it("hands focus back to the opener on unmount", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    try {
      const { unmount } = render(<Scope initialFocus="container" />);
      expect(document.activeElement).not.toBe(opener);
      unmount();
      expect(document.activeElement).toBe(opener);
    } finally {
      opener.remove();
    }
  });

  it("returns focus on close (enabled → false), while the panel is still mounted for its exit", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    try {
      const { rerender, getByTestId } = render(<Scope initialFocus="container" />);
      expect(document.activeElement).toBe(getByTestId("scope"));
      rerender(<Scope initialFocus="container" enabled={false} />);
      expect(document.activeElement).toBe(opener);
    } finally {
      opener.remove();
    }
  });

  it("falls back to the trigger when nothing was focused before opening (Safari's clicked button)", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    (document.activeElement as HTMLElement | null)?.blur();
    const triggerRef = { current: trigger };
    try {
      const { rerender } = render(<Scope initialFocus="container" returnFocusTo={triggerRef} />);
      rerender(<Scope initialFocus="container" returnFocusTo={triggerRef} enabled={false} />);
      expect(document.activeElement).toBe(trigger);
    } finally {
      trigger.remove();
    }
  });

  it("falls back to the trigger when the opener was re-rendered away", () => {
    const opener = document.createElement("button");
    const trigger = document.createElement("button");
    document.body.append(opener, trigger);
    opener.focus();
    const triggerRef = { current: trigger };
    try {
      const { rerender } = render(<Scope initialFocus="container" returnFocusTo={triggerRef} />);
      opener.remove();
      rerender(<Scope initialFocus="container" returnFocusTo={triggerRef} enabled={false} />);
      expect(document.activeElement).toBe(trigger);
    } finally {
      trigger.remove();
    }
  });

  it("leaves focus alone when it already left the scope (a click outside landed on a field)", () => {
    const opener = document.createElement("button");
    const field = document.createElement("input");
    document.body.append(opener, field);
    opener.focus();
    try {
      const { rerender } = render(<Scope initialFocus="container" />);
      field.focus();
      rerender(<Scope initialFocus="container" enabled={false} />);
      expect(document.activeElement).toBe(field);
    } finally {
      opener.remove();
      field.remove();
    }
  });
});
