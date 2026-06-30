import * as React from "react";
import { cn } from "../lib/cn";
import { Slot } from "../primitives/slot";
import { BADGE_BASE, badgeVariants, type BadgeVariant } from "../generated/badge";

export type { BadgeVariant };

export interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant;
  asChild?: boolean;
}

export function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(BADGE_BASE, badgeVariants[variant], className)}
      {...(props as Record<string, unknown>)}
    />
  );
}
