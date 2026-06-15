import * as React from "react";
import { cn } from "../lib/cn";
import { Slot } from "../primitives/slot";
import { Separator } from "./separator";

export function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn("group/item-group flex flex-col", className)}
      {...props}
    />
  );
}

export function ItemSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn("my-0", className)}
      {...props}
    />
  );
}

const ITEM_BASE =
  "group/item flex items-center border border-transparent text-sm rounded-md transition-colors " +
  "[a]:hover:bg-accent/50 [a]:transition-colors duration-100 flex-wrap outline-none " +
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const itemVariants = {
  default: "bg-transparent",
  outline: "border-border",
  muted: "bg-muted/50",
} as const;

const itemSizes = {
  default: "p-4 gap-4 ",
  sm: "py-3 px-4 gap-2.5",
} as const;

export type ItemVariant = keyof typeof itemVariants;
export type ItemSize = keyof typeof itemSizes;

export interface ItemProps extends React.ComponentProps<"div"> {
  variant?: ItemVariant;
  size?: ItemSize;
  asChild?: boolean;
}

export function Item({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ItemProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="item"
      data-variant={variant}
      data-size={size}
      className={cn(ITEM_BASE, itemVariants[variant], itemSizes[size], className)}
      {...(props as Record<string, unknown>)}
    />
  );
}

const ITEM_MEDIA_BASE =
  "flex shrink-0 items-center justify-center gap-2 " +
  "group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none " +
  "group-has-[[data-slot=item-description]]/item:translate-y-0.5";

const itemMediaVariants = {
  default: "bg-transparent",
  icon: "size-8 border rounded-sm bg-muted [&_svg:not([class*='size-'])]:size-4",
  image:
    "size-10 rounded-sm overflow-hidden [&_img]:size-full [&_img]:object-cover",
} as const;

export type ItemMediaVariant = keyof typeof itemMediaVariants;

export interface ItemMediaProps extends React.ComponentProps<"div"> {
  variant?: ItemMediaVariant;
}

export function ItemMedia({
  className,
  variant = "default",
  ...props
}: ItemMediaProps) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(ITEM_MEDIA_BASE, itemMediaVariants[variant], className)}
      {...props}
    />
  );
}

export function ItemContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn(
        "flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none",
        className,
      )}
      {...props}
    />
  );
}

export function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        "flex w-fit items-center gap-2 text-sm leading-snug font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function ItemDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "text-muted-foreground line-clamp-2 text-sm leading-normal font-normal text-balance " +
          "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className,
      )}
      {...props}
    />
  );
}

export function ItemActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

export function ItemHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-header"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className,
      )}
      {...props}
    />
  );
}

export function ItemFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-footer"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className,
      )}
      {...props}
    />
  );
}
