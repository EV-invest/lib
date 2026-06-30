import * as React from "react";
import { cn } from "../lib/cn";
import { AVATAR, AVATAR_IMAGE, AVATAR_FALLBACK } from "../generated/avatar";

export function Avatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar"
      className={cn(AVATAR, className)}
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
      className={cn(AVATAR_IMAGE, className)}
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
      className={cn(AVATAR_FALLBACK, className)}
      {...props}
    />
  );
}
