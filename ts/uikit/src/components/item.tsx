import * as React from "react";
import { cn } from "../lib/cn";
import { Slot } from "../primitives/slot";
import { Separator } from "./separator";
import {
  ITEM_ACTIONS,
  ITEM_BASE,
  ITEM_CONTENT,
  ITEM_DESCRIPTION,
  ITEM_FOOTER,
  ITEM_GROUP,
  ITEM_HEADER,
  ITEM_MEDIA_BASE,
  ITEM_SEPARATOR,
  ITEM_TITLE,
  itemMediaVariants,
  itemSizes,
  itemVariants,
  type ItemMediaVariant,
  type ItemSize,
  type ItemVariant,
} from "../generated/item";

export type { ItemMediaVariant, ItemSize, ItemVariant };

export function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn(ITEM_GROUP, className)}
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
      className={cn(ITEM_SEPARATOR, className)}
      {...props}
    />
  );
}

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
      className={cn(ITEM_CONTENT, className)}
      {...props}
    />
  );
}

export function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn(ITEM_TITLE, className)}
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
      className={cn(ITEM_DESCRIPTION, className)}
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
      className={cn(ITEM_ACTIONS, className)}
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
      className={cn(ITEM_HEADER, className)}
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
      className={cn(ITEM_FOOTER, className)}
      {...props}
    />
  );
}
