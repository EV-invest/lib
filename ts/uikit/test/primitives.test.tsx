import { describe, it, expect } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
import { useControllableState } from "../src/primitives/use-controllable-state";
import { useRovingFocus } from "../src/primitives/use-roving-focus";
import { Portal } from "../src/primitives/portal";

describe("useControllableState", () => {
  it("owns state when uncontrolled", () => {
    const { result } = renderHook(() =>
      useControllableState({ defaultValue: 1 }),
    );
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
  });

  it("reflects the controlled value and routes writes through onChange", () => {
    const seen: number[] = [];
    const { result, rerender } = renderHook(
      ({ value }) =>
        useControllableState({ value, defaultValue: 0, onChange: (v) => seen.push(v) }),
      { initialProps: { value: 5 } },
    );
    expect(result.current[0]).toBe(5);
    act(() => result.current[1](6));
    expect(seen).toEqual([6]);
    expect(result.current[0]).toBe(5); // unchanged until parent updates
    rerender({ value: 6 });
    expect(result.current[0]).toBe(6);
  });
});

describe("useRovingFocus", () => {
  it("wraps with ArrowDown when looping", () => {
    const { result } = renderHook(() =>
      useRovingFocus({ count: 3, orientation: "vertical" }),
    );
    const ev = (key: string) =>
      ({ key, preventDefault() {} }) as unknown as React.KeyboardEvent;
    expect(result.current.activeIndex).toBe(0);
    act(() => result.current.onKeyDown(ev("ArrowDown")));
    expect(result.current.activeIndex).toBe(1);
    act(() => result.current.onKeyDown(ev("End")));
    expect(result.current.activeIndex).toBe(2);
    act(() => result.current.onKeyDown(ev("ArrowDown")));
    expect(result.current.activeIndex).toBe(0);
  });
});

describe("Portal", () => {
  it("renders children into document.body", () => {
    render(<Portal>portaled</Portal>);
    expect(document.body.textContent).toContain("portaled");
  });
});
