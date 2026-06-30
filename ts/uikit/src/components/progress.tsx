import * as React from "react";
import { cn } from "../lib/cn";
import { PROGRESS_TRACK, PROGRESS_INDICATOR } from "../generated/progress";

export interface ProgressProps extends React.ComponentProps<"div"> {
  value?: number;
}

export function Progress({ className, value = 0, ...props }: ProgressProps) {
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(PROGRESS_TRACK, className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={PROGRESS_INDICATOR}
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </div>
  );
}
