import * as React from "react";
import { cn } from "../lib/cn";
import {
  EMPTY,
  EMPTY_CONTENT,
  EMPTY_DESCRIPTION,
  EMPTY_HEADER,
  EMPTY_MEDIA_BASE,
  EMPTY_TITLE,
  emptyMediaVariants,
  type EmptyMediaVariant,
} from "../generated/empty";

export type { EmptyMediaVariant };

export function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="empty" className={cn(EMPTY, className)} {...props} />
  );
}

export function EmptyHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(EMPTY_HEADER, className)}
      {...props}
    />
  );
}

export interface EmptyMediaProps extends React.ComponentProps<"div"> {
  variant?: EmptyMediaVariant;
}

export function EmptyMedia({
  className,
  variant = "default",
  ...props
}: EmptyMediaProps) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(EMPTY_MEDIA_BASE, emptyMediaVariants[variant], className)}
      {...props}
    />
  );
}

export function EmptyTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn(EMPTY_TITLE, className)}
      {...props}
    />
  );
}

export function EmptyDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(EMPTY_DESCRIPTION, className)}
      {...props}
    />
  );
}

export function EmptyContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(EMPTY_CONTENT, className)}
      {...props}
    />
  );
}
