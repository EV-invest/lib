import * as React from "react";
import { cn } from "../lib/cn";

export type ContainerProps = React.ComponentProps<"div">;

/**
 * Page-width wrapper: centres content, caps it at `--page-max` and applies the
 * responsive `--page-px` gutter (tighter on mobile, roomier ≥ sm). Standardises
 * the `<div className="container">` consumers were repeating, so the page gutter
 * and max width live in one token-driven place.
 */
export function Container({ className, ...props }: ContainerProps) {
  return (
    <div
      data-slot="container"
      className={cn(
        "mx-auto w-full max-w-[var(--page-max,90rem)] px-[var(--page-px,1rem)]",
        className,
      )}
      {...props}
    />
  );
}
