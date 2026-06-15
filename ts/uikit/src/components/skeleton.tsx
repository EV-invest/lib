import * as React from "react";
import { cn } from "../lib/cn";

const SKELETON_BASE = "bg-accent animate-pulse rounded-md";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(SKELETON_BASE, className)}
      {...props}
    />
  );
}
