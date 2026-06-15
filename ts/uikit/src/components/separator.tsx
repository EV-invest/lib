import * as React from "react";
import { cn } from "../lib/cn";

const SEPARATOR_BASE = "bg-border shrink-0";

const separatorOrientations = {
  horizontal:
    "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
  vertical:
    "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
} as const;

export type SeparatorOrientation = keyof typeof separatorOrientations;

export interface SeparatorProps extends React.ComponentProps<"div"> {
  orientation?: SeparatorOrientation;
}

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  return (
    <div
      role="separator"
      data-slot="separator"
      data-orientation={orientation}
      className={cn(
        SEPARATOR_BASE,
        separatorOrientations[orientation],
        className,
      )}
      {...props}
    />
  );
}
