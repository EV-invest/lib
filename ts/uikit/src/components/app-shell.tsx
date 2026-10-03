import * as React from "react";
import { cn } from "../lib/cn";

/** Where the shell swaps the bottom tab bar for the rail. */
export type ShellBreakpoint = "md" | "lg";

export interface AppShellProps extends React.ComponentProps<"div"> {
  /** The desktop rail — a `ShellNav`. Shown from `breakpoint` up. */
  rail?: React.ReactNode;
  /** The phone's tab bar — a `BottomTabBar`. Pinned to the viewport bottom below `breakpoint`. */
  tabBar?: React.ReactNode;
  /** Strips above the page (`SystemBanner`s). An empty slot takes no room. */
  banner?: React.ReactNode;
  /** Default `lg`. */
  breakpoint?: ShellBreakpoint;
  /** Props for the `<main>` the page renders into (an `id` for a skip link, say). */
  mainProps?: React.ComponentProps<"main">;
}

// Tailwind only sees whole class strings, so each breakpoint spells its own.
const AT = {
  md: {
    rail: "hidden md:flex",
    tabBar: "md:hidden",
    reserve: "pb-[calc(var(--shell-tab-bar-h)+env(safe-area-inset-bottom,0px))] md:pb-0",
    banner: "md:px-8",
  },
  lg: {
    rail: "hidden lg:flex",
    tabBar: "lg:hidden",
    reserve: "pb-[calc(var(--shell-tab-bar-h)+env(safe-area-inset-bottom,0px))] lg:pb-0",
    banner: "lg:px-8",
  },
} as const;

const present = (node: React.ReactNode) => node !== null && node !== undefined && node !== false;

/**
 * The signed-in app's frame: a rail beside a content column on a wide screen, a
 * bottom tab bar under it on a phone. Layout only — the nav, the banners and the
 * page are slots, so the shell knows nothing about routes, roles or data.
 *
 * Fills the viewport less `--ev-shell-offset` (the room a host shell's own header
 * takes); the rail sticks under that offset at full remaining height and scrolls
 * by itself when it cannot fit. The column reserves the tab bar's height plus
 * the bottom safe area, so the bar never covers content.
 */
export function AppShell({
  rail,
  tabBar,
  banner,
  breakpoint = "lg",
  mainProps,
  className,
  children,
  ...props
}: AppShellProps) {
  const at = AT[breakpoint];
  return (
    <div
      data-slot="app-shell"
      data-breakpoint={breakpoint}
      className={cn(
        "flex min-h-[calc(100dvh-var(--ev-shell-offset,0px))] bg-background",
        className,
      )}
      {...props}
    >
      {present(rail) && (
        <div
          data-slot="app-shell-rail"
          className={cn(
            "sticky top-[var(--ev-shell-offset,0px)] h-[calc(100dvh-var(--ev-shell-offset,0px))] shrink-0 self-start",
            at.rail,
          )}
        >
          {rail}
        </div>
      )}
      <div
        data-slot="app-shell-content"
        className={cn("flex min-w-0 flex-1 flex-col", present(tabBar) && at.reserve)}
      >
        {present(banner) && (
          <div
            data-slot="app-shell-banner"
            className={cn("flex flex-col gap-2 px-4 pt-4 empty:hidden", at.banner)}
          >
            {banner}
          </div>
        )}
        <main {...mainProps} className={cn("min-w-0 flex-1", mainProps?.className)}>
          {children}
        </main>
      </div>
      {present(tabBar) && (
        <div
          data-slot="app-shell-tab-bar"
          className={cn("fixed inset-x-0 bottom-0 z-40", at.tabBar)}
        >
          {tabBar}
        </div>
      )}
    </div>
  );
}
