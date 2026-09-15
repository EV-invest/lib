import * as React from "react";
import { cn } from "../lib/cn";
import { Slot } from "../primitives/slot";
import { accentFillClasses, accentOutlineClasses, type Accent } from "../generated/accent";
import {
  BUTTON_BASE,
  buttonIconSizeClasses,
  buttonSizeClasses,
  buttonVariantClasses,
  type ButtonSize,
  type ButtonVariant,
} from "../generated/button";

export type { Accent, ButtonSize, ButtonVariant };

export interface ButtonVariantsOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A square button holding a bare glyph; `size` still picks the magnitude. */
  icon?: boolean;
  /** Recolours the button at an accent rung; unset is the normal case. */
  accent?: Accent | undefined;
  className?: string;
}

/**
 * Returns the fused canonical button class string. Reused by `pagination` so a
 * non-`Button` element can adopt the same styling, mirroring Rust's
 * `button_classes`.
 *
 * The accent fuses after the variant so it recolours whatever the variant set.
 */
export function buttonVariants({
  variant = "primary",
  size = "md",
  icon = false,
  accent,
  className,
}: ButtonVariantsOptions = {}): string {
  return cn(
    BUTTON_BASE,
    buttonVariantClasses[variant],
    icon ? buttonIconSizeClasses[size] : buttonSizeClasses[size],
    accent === undefined ? undefined : accentClass(accent, variant),
    className,
  );
}

// Which face an accent wears is the variant's business — an outlined button tints
// what it already has, anything else repaints. Mirrors Rust's `button_accent_class`.
function accentClass(accent: Accent, variant: ButtonVariant): string {
  return variant === "outline" ? accentOutlineClasses[accent] : accentFillClasses[accent];
}

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
  accent?: Accent;
  asChild?: boolean;
  /** Renders an `<a>` wearing the button's classes — a link that looks like a
   *  call to action is still a link. */
  href?: string;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  icon = false,
  accent,
  asChild = false,
  href,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : href !== undefined ? "a" : "button";
  return (
    <Comp
      data-slot="button"
      href={href}
      className={cn(buttonVariants({ variant, size, icon, accent }), className)}
      {...(props as Record<string, unknown>)}
    />
  );
}
