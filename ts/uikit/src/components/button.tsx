import * as React from "react";
import { cn } from "../lib/cn";
import { Slot } from "../primitives/slot";
import {
  BUTTON_BASE,
  buttonSizeClasses,
  buttonVariantClasses,
  type ButtonSize,
  type ButtonVariant,
} from "../generated/variants";

export type { ButtonSize, ButtonVariant };

export interface ButtonVariantsOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/**
 * Returns the fused canonical button class string. Reused by `pagination` so a
 * non-`Button` element can adopt the same styling, mirroring Rust's
 * `button_classes`.
 */
export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: ButtonVariantsOptions = {}): string {
  return cn(BUTTON_BASE, buttonVariantClasses[variant], buttonSizeClasses[size], className);
}

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...(props as Record<string, unknown>)}
    />
  );
}
