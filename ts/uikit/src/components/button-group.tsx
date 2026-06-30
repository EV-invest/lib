import * as React from "react";
import { cn } from "../lib/cn";
import { Slot } from "../primitives/slot";
import {
  BUTTON_GROUP_BASE,
  BUTTON_GROUP_SEPARATOR_BASE,
  BUTTON_GROUP_TEXT_BASE,
  buttonGroupOrientationClasses,
  type ButtonGroupOrientation,
} from "../generated/button-group";

export type { ButtonGroupOrientation };

export interface ButtonGroupProps extends React.ComponentProps<"div"> {
  orientation?: ButtonGroupOrientation;
}

export function ButtonGroup({
  className,
  orientation = "horizontal",
  ...props
}: ButtonGroupProps) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(BUTTON_GROUP_BASE, buttonGroupOrientationClasses[orientation], className)}
      {...props}
    />
  );
}

export interface ButtonGroupTextProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
}

export function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: ButtonGroupTextProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(BUTTON_GROUP_TEXT_BASE, className)}
      {...(props as Record<string, unknown>)}
    />
  );
}

export function ButtonGroupSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="separator"
      data-slot="button-group-separator"
      data-orientation="vertical"
      className={cn(BUTTON_GROUP_SEPARATOR_BASE, className)}
      {...props}
    />
  );
}
