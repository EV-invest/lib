import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";

const TOGGLE_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium " +
  "hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 " +
  "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none " +
  "[&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring " +
  "focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] " +
  "aria-invalid:ring-destructive/20 aria-invalid:border-destructive whitespace-nowrap";

const toggleVariantClasses = {
  default: "bg-transparent",
  outline:
    "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
} as const;

const toggleSizeClasses = {
  default: "h-9 px-2 min-w-9",
  sm: "h-8 px-1.5 min-w-8",
  lg: "h-10 px-2.5 min-w-10",
} as const;

export type ToggleVariant = keyof typeof toggleVariantClasses;
export type ToggleSize = keyof typeof toggleSizeClasses;

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
