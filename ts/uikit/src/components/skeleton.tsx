import * as React from "react";
import { cn } from "../lib/cn";
import { SKELETON_BASE } from "../generated/skeleton";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(SKELETON_BASE, className)}
      {...props}
    />
  );
}
