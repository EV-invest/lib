import * as React from "react";
import { cn } from "../lib/cn";
import {
  SEPARATOR_BASE,
  separatorOrientations,
  type SeparatorOrientation,
} from "../generated/separator";

export type { SeparatorOrientation };

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
