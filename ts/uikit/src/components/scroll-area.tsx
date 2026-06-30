import * as React from "react";
import { cn } from "../lib/cn";
import {
  SCROLL_AREA_THUMB,
  SCROLL_AREA_VIEWPORT,
  SCROLLBAR_BASE,
  scrollBarOrientations,
  type ScrollBarOrientation,
} from "../generated/scroll-area";

export type { ScrollBarOrientation };

// Dep-light scroll area: a viewport `div` with native `overflow` scrolling.
// Custom scrollbar thumb tracking is omitted — native overflow does the work;
// `ScrollBar` is a static decorative element kept for class parity.

export function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div data-slot="scroll-area" className={cn("relative", className)} {...props}>
      <div data-slot="scroll-area-viewport" className={SCROLL_AREA_VIEWPORT}>
        {children}
      </div>
      <ScrollBar />
    </div>
  );
}

export interface ScrollBarProps extends React.ComponentProps<"div"> {
  orientation?: ScrollBarOrientation;
}

export function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollBarProps) {
  return (
    <div
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      className={cn(SCROLLBAR_BASE, scrollBarOrientations[orientation], className)}
      {...props}
    >
      <div data-slot="scroll-area-thumb" className={SCROLL_AREA_THUMB} />
    </div>
  );
}
