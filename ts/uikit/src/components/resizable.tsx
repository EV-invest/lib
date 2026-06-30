import * as React from "react";
import { cn } from "../lib/cn";
import {
  RESIZABLE_GROUP,
  RESIZABLE_HANDLE,
  RESIZABLE_HANDLE_GRIP,
  RESIZABLE_PANEL,
} from "../generated/resizable";

export type ResizableDirection = "horizontal" | "vertical";

interface ResizableContextValue {
  sizes: number[];
  setSizes: React.Dispatch<React.SetStateAction<number[]>>;
  register: (index: number, defaultSize: number) => void;
  direction: ResizableDirection;
  keyboardStep: number;
  groupRef: React.RefObject<HTMLDivElement | null>;
}

const ResizableContext = React.createContext<ResizableContextValue | null>(null);

function useResizable(): ResizableContextValue {
  const ctx = React.useContext(ResizableContext);
  if (!ctx)
    throw new Error("Resizable parts must be used within a ResizablePanelGroup");
  return ctx;
}

/** Grows the panel before `index` by `delta` %, shrinking the one after it. */
function redistribute(sizes: number[], index: number, delta: number): number[] {
  const before = sizes[index];
  const after = sizes[index + 1];
  if (before === undefined || after === undefined) return sizes;
  const moved = Math.max(-before, Math.min(after, delta));
  const next = sizes.slice();
  next[index] = before + moved;
  next[index + 1] = after - moved;
  return next;
}

export interface ResizablePanelGroupProps
  extends React.ComponentProps<"div"> {
  direction?: ResizableDirection;
  keyboardStep?: number;
  onLayout?: (sizes: number[]) => void;
}

export function ResizablePanelGroup({
  className,
  direction = "horizontal",
  keyboardStep = 10,
  onLayout,
  children,
  ...props
}: ResizablePanelGroupProps) {
  const [sizes, setSizes] = React.useState<number[]>([]);
  const groupRef = React.useRef<HTMLDivElement>(null);

  const register = React.useCallback((index: number, defaultSize: number) => {
    setSizes((prev) => {
      if (prev[index] !== undefined) return prev;
      const next = prev.slice();
      while (next.length <= index) next.push(0);
      next[index] = defaultSize;
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (sizes.length) onLayout?.(sizes);
  }, [sizes, onLayout]);

  const value = React.useMemo<ResizableContextValue>(
    () => ({ sizes, setSizes, register, direction, keyboardStep, groupRef }),
    [sizes, register, direction, keyboardStep],
  );

  return (
    <ResizableContext.Provider value={value}>
      <div
        ref={groupRef}
        data-slot="resizable-panel-group"
        data-panel-group-direction={direction}
        className={cn(RESIZABLE_GROUP, className)}
        {...props}
      >
        {children}
      </div>
    </ResizableContext.Provider>
  );
}

export interface ResizablePanelProps extends React.ComponentProps<"div"> {
  index: number;
  defaultSize?: number;
}

export function ResizablePanel({
  className,
  index,
  defaultSize = 50,
  style,
  children,
  ...props
}: ResizablePanelProps) {
  const { sizes, register } = useResizable();
  React.useEffect(() => {
    register(index, defaultSize);
  }, [register, index, defaultSize]);
  const basis = sizes[index] ?? defaultSize;
  return (
    <div
      data-slot="resizable-panel"
      className={cn(RESIZABLE_PANEL, className)}
      style={{ flex: `${basis} 1 0%`, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ResizableHandleProps extends React.ComponentProps<"div"> {
  index: number;
  withHandle?: boolean;
}

export function ResizableHandle({
  className,
  index,
  withHandle,
  children,
  ...props
}: ResizableHandleProps) {
  const { setSizes, direction, keyboardStep, groupRef } = useResizable();
  const draggingRef = React.useRef(false);

  const resize = React.useCallback(
    (delta: number) => setSizes((prev) => redistribute(prev, index, delta)),
    [setSizes, index],
  );

  const onPointerMove = React.useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current) return;
      const rect = groupRef.current?.getBoundingClientRect();
      if (!rect) return;
      const span = direction === "vertical" ? rect.height : rect.width;
      if (span <= 0) return;
      const px = direction === "vertical" ? event.movementY : event.movementX;
      resize((px / span) * 100);
    },
    [direction, resize, groupRef],
  );

  const onPointerUp = React.useCallback(() => {
    draggingRef.current = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    draggingRef.current = true;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  React.useEffect(() => () => onPointerUp(), [onPointerUp]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    let delta: number;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        delta = -keyboardStep;
        break;
      case "ArrowRight":
      case "ArrowDown":
        delta = keyboardStep;
        break;
      default:
        return;
    }
    if (
      (direction === "horizontal" &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")) ||
      (direction === "vertical" &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight"))
    )
      return;
    event.preventDefault();
    resize(delta);
  };

  return (
    <div
      data-slot="resizable-handle"
      data-panel-group-direction={direction}
      role="separator"
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      tabIndex={0}
      className={cn(RESIZABLE_HANDLE, className)}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      {...props}
    >
      {withHandle && (
        <div className={RESIZABLE_HANDLE_GRIP}>
          <svg
            className="size-2.5"
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="9" cy="12" r="1" />
            <circle cx="9" cy="5" r="1" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="15" cy="5" r="1" />
            <circle cx="15" cy="19" r="1" />
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}
