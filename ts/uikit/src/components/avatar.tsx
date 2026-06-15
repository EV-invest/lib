import * as React from "react";
import { cn } from "../lib/cn";

export function Avatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  onError,
  ...props
}: React.ComponentProps<"img">) {
  const [errored, setErrored] = React.useState(false);
  if (errored) return null;
  return (
    <img
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      onError={(e) => {
        onError?.(e);
        setErrored(true);
      }}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className,
      )}
      {...props}
    />
  );
}
