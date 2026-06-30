import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import {
  TOGGLE_BASE,
  toggleSizeClasses,
  toggleVariantClasses,
  type ToggleSize,
  type ToggleVariant,
} from "../generated/toggle";

export type { ToggleSize, ToggleVariant };

export interface ToggleVariantsOptions {
  variant?: ToggleVariant;
  size?: ToggleSize;
  className?: string;
}

/**
 * Returns the fused canonical toggle class string. Reused by `toggle-group` so
 * its items adopt the same styling, mirroring Rust's `toggle_classes`.
 */
export function toggleVariants({
  variant = "default",
  size = "default",
  className,
}: ToggleVariantsOptions = {}): string {
  return cn(TOGGLE_BASE, toggleVariantClasses[variant], toggleSizeClasses[size], className);
}

export interface ToggleProps
  extends Omit<React.ComponentProps<"button">, "onChange"> {
  variant?: ToggleVariant;
  size?: ToggleSize;
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

export function Toggle({
  className,
  variant = "default",
  size = "default",
  pressed,
  defaultPressed = false,
  onPressedChange,
  onClick,
  ...props
}: ToggleProps) {
  const [on, setOn] = useControllableState<boolean>({
    ...(pressed !== undefined ? { value: pressed } : {}),
    defaultValue: defaultPressed,
    ...(onPressedChange ? { onChange: onPressedChange } : {}),
  });
  return (
    <button
      type="button"
      data-slot="toggle"
      data-state={on ? "on" : "off"}
      aria-pressed={on}
      className={cn(toggleVariants({ variant, size }), className)}
      onClick={(e) => {
        onClick?.(e);
        setOn(!on);
      }}
      {...props}
    />
  );
}
