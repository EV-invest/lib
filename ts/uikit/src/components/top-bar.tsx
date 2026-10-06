import * as React from "react";
import { cn } from "../lib/cn";

export interface TopBarProps extends React.ComponentProps<"header"> {
  /** The app switcher, or the service's name. */
  start?: React.ReactNode;
  /** Service stats, then an `AccountMenu` last. */
  end?: React.ReactNode;
}

/**
 * The wide screen's utility bar over the content column: who and where, never
 * product nav (that is the rail's). Layout only — `AppShell.topBar` pins it.
 */
export function TopBar({ start, end, className, ...props }: TopBarProps) {
  return (
    <header
      data-slot="top-bar"
      className={cn("flex h-14 items-center gap-3 border-b border-border bg-background px-8", className)}
      {...props}
    >
      <div data-slot="top-bar-start" className="flex min-w-0 items-center gap-2">
        {start}
      </div>
      <div data-slot="top-bar-end" className="ml-auto flex shrink-0 items-center gap-3">
        {end}
      </div>
    </header>
  );
}
