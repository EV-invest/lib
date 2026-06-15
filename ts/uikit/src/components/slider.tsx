import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";

const ROOT_BASE =
  "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 " +
  "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 " +
  "data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col";
const TRACK_BASE =
  "bg-muted relative grow overflow-hidden rounded-full " +
  "data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full " +
  "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5";
const RANGE_BASE =
  "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full";
const THUMB_BASE =
  "border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm " +
  "transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden " +
  "disabled:pointer-events-none disabled:opacity-50";

type Orientation = "horizontal" | "vertical";

function clampStep(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  if (step <= 0) return clamped;
  const steps = Math.round((clamped - min) / step);
  return Math.min(max, Math.max(min, min + steps * step));
}

export interface SliderProps
  extends Omit<React.ComponentProps<"span">, "defaultValue" | "onChange"> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  orientation?: Orientation;
  disabled?: boolean;
}

export function Slider({
  className,
  value,
  defaultValue = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  orientation = "horizontal",
  disabled = false,
  ...props
}: SliderProps) {
  const [raw, setRaw] = useControllableState<number>({
    ...(value !== undefined ? { value } : {}),
    defaultValue,
    ...(onValueChange ? { onChange: onValueChange } : {}),
  });
  const current = clampStep(raw, min, max, step);
  const span = Math.max(max - min, Number.EPSILON);
  const percent = Math.min(100, Math.max(0, ((current - min) / span) * 100));

  const trackRef = React.useRef<HTMLSpanElement>(null);
  const draggingRef = React.useRef(false);

  const valueFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return current;
      const ratio =
        orientation === "vertical"
          ? (rect.bottom - clientY) / rect.height
          : (clientX - rect.left) / rect.width;
      return clampStep(min + ratio * (max - min), min, max, step);
    },
    [current, orientation, min, max, step],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = current + step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = current - step;
        break;
      case "Home":
        next = min;
        break;
      case "End":
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    setRaw(clampStep(next, min, max, step));
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (disabled) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setRaw(valueFromPointer(event.clientX, event.clientY));
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current || disabled) return;
    setRaw(valueFromPointer(event.clientX, event.clientY));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const rangeStyle: React.CSSProperties =
    orientation === "vertical" ? { height: `${percent}%` } : { width: `${percent}%` };
  const thumbStyle: React.CSSProperties =
    orientation === "vertical" ? { bottom: `${percent}%` } : { left: `${percent}%` };

  return (
    <span
      data-slot="slider"
      data-orientation={orientation}
      data-disabled={disabled || undefined}
      className={cn(ROOT_BASE, className)}
      {...props}
    >
      <span
        ref={trackRef}
        data-slot="slider-track"
        data-orientation={orientation}
        className={TRACK_BASE}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span
          data-slot="slider-range"
          data-orientation={orientation}
          className={RANGE_BASE}
          style={rangeStyle}
        />
      </span>
      <span
        data-slot="slider-thumb"
        data-orientation={orientation}
        className={THUMB_BASE}
        style={thumbStyle}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuenow={current}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-orientation={orientation}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
      />
    </span>
  );
}
