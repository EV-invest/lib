import * as React from "react";
import { cn } from "../lib/cn";
import { Slot } from "../primitives/slot";
import {
  BUTTON_BASE,
  buttonSizeClasses,
  buttonVariantClasses,
  type ButtonSize,
  type ButtonVariant,
} from "../generated/button";

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
  /** Renders an `<a>` wearing the button's classes — a link that looks like a
   *  call to action is still a link. */
  href?: string;
}

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  href,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : href !== undefined ? "a" : "button";
  return (
    <Comp
      data-slot="button"
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
      {...(props as Record<string, unknown>)}
    />
  );
}
