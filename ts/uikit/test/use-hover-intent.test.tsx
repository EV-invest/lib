import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PointerEvent } from "react";
import { useHoverIntent } from "../src/primitives/use-hover-intent";

// jsdom has no PointerEvent and drops `pointerType`, so drive the handlers with
// hand-made events — the hook only ever reads `pointerType`.
const evt = (pointerType: string) =>
  ({ pointerType }) as unknown as PointerEvent;

describe("useHoverIntent", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens only after the mouse dwells for openDelay", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useHoverIntent({ onOpen, onClose, openDelay: 500 }),
    );

    act(() => result.current.onPointerEnter(evt("mouse")));
    expect(onOpen).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(499));
    expect(onOpen).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("ignores touch and pen pointers (they have no hover)", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useHoverIntent({ onOpen, onClose, openDelay: 500 }),
    );

    act(() => result.current.onPointerEnter(evt("touch")));
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.onPointerEnter(evt("pen")));
    act(() => vi.advanceTimersByTime(2000));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("cancels a pending open when the cursor leaves before the delay", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useHoverIntent({ onOpen, onClose, openDelay: 500 }),
    );

    act(() => result.current.onPointerEnter(evt("mouse")));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.onPointerLeave(evt("mouse")));
    act(() => vi.advanceTimersByTime(1000));
    expect(onOpen).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes immediately on leave with the default closeDelay of 0", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() => useHoverIntent({ onOpen, onClose }));

    act(() => result.current.onPointerLeave(evt("mouse")));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
