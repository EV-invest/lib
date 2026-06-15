import * as React from "react";
import { cn } from "../lib/cn";
import { Slot } from "../primitives/slot";

const BADGE_BASE =
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs " +
  "font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden " +
  "[&>svg]:size-3 [&>svg]:pointer-events-none transition-[color,box-shadow] " +
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] " +
  "aria-invalid:ring-destructive/20 aria-invalid:border-destructive";

const badgeVariants = {
  default:
    "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
  destructive:
    "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20",
  outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
  success: "border-transparent bg-main-accent-t2/20 text-main-accent-t2",
} as const;

export type BadgeVariant = keyof typeof badgeVariants;

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
