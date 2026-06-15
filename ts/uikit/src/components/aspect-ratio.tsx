import * as React from "react";
import { cn } from "../lib/cn";

export interface AspectRatioProps extends React.ComponentProps<"div"> {
  ratio?: number;
}

export function AspectRatio({
  ratio = 1,
  className,
  style,
  ...props
}: AspectRatioProps) {
  return (
    <div
      data-slot="aspect-ratio"
      className={cn(className)}
      style={{ aspectRatio: ratio, ...style }}
      {...props}
    />
  );
}
