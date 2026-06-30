import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { SLIDER_RANGE, SLIDER_ROOT, SLIDER_THUMB, SLIDER_TRACK } from "../generated/slider";

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
  // The thumb is absolutely positioned within the (relative) root and centered
  // on the value point; without `position:absolute` the `%` offset is ignored and
  // flow layout parks it at the end of the row.
  const thumbStyle: React.CSSProperties =
    orientation === "vertical"
      ? { position: "absolute", bottom: `${percent}%`, left: "50%", transform: "translate(-50%, 50%)" }
      : { position: "absolute", left: `${percent}%`, top: "50%", transform: "translate(-50%, -50%)" };

  return (
    <span
      data-slot="slider"
      data-orientation={orientation}
      data-disabled={disabled || undefined}
      className={cn(SLIDER_ROOT, className)}
      {...props}
      // Pointer handling lives on the root, not the track: the thumb sits above
      // the track (absolute), so grabbing it must still start a drag.
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <span
        ref={trackRef}
        data-slot="slider-track"
        data-orientation={orientation}
        className={SLIDER_TRACK}
      >
        <span
          data-slot="slider-range"
          data-orientation={orientation}
          className={SLIDER_RANGE}
          style={rangeStyle}
        />
      </span>
      <span
        data-slot="slider-thumb"
        data-orientation={orientation}
        className={SLIDER_THUMB}
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
