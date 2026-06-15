import * as React from "react";
import { cn } from "../lib/cn";
import { Slot } from "../primitives/slot";

const BUTTON_GROUP_BASE =
  "flex w-fit items-stretch [&>*]:focus-visible:z-10 [&>*]:focus-visible:relative " +
  "[&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 " +
  "has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md " +
  "has-[>[data-slot=button-group]]:gap-2";

const buttonGroupOrientationClasses = {
  horizontal:
    "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
  vertical:
    "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
} as const;

export type ButtonGroupOrientation = keyof typeof buttonGroupOrientationClasses;

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
      className={cn(
        "bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium " +
          "shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
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
      className={cn(
        "bg-input relative !m-0 self-stretch shrink-0 data-[orientation=vertical]:h-auto",
        className,
      )}
      {...props}
    />
  );
}
