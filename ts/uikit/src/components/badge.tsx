import * as React from "react";
import { cn } from "../lib/cn";
import { FILLED_FOCUS_RING } from "../lib/focus";
import { Slot } from "../primitives/slot";
import { BADGE_BASE, badgeVariants, type BadgeVariant } from "../generated/badge";

export type { BadgeVariant };

// A badge only takes focus as a link (`asChild` over an `<a>`); the filled ones
// get the offset ring for the reason `FILLED_FOCUS_RING` gives. TS-side until
// the shared class table (`rust/classes/src/badge.rs`) carries it.
const FILLED: ReadonlySet<BadgeVariant> = new Set(["primary", "secondary", "destructive"]);

export interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant;
  asChild?: boolean;
}

export function Badge({
  className,
  variant = "primary",
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(
        BADGE_BASE,
        badgeVariants[variant],
        FILLED.has(variant) ? FILLED_FOCUS_RING : undefined,
        className,
      )}
      {...(props as Record<string, unknown>)}
    />
  );
}
