"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import type { ShellBreakpoint } from "./app-shell";
import { ChevronLeftIcon } from "./shell-icons";

export interface MobileAppBarLabels {
  /** Accessible name of the back control. Default `"Back"`. */
  back?: string;
}

export type MobileAppBarBack = { href: string } | { onClick: () => void };

export interface MobileAppBarProps extends Omit<React.ComponentProps<"header">, "title"> {
  title: React.ReactNode;
  /** A pushed screen: a back link (`href`) or a back button (`onClick`); centres the title. */
  back?: MobileAppBarBack;
  /** Trailing action — Save, a menu. */
  right?: React.ReactNode;
  linkComponent?: React.ElementType;
  /** Hidden from this breakpoint up, where the page heading takes over. Default `lg`; `false` never hides. */
  hideFrom?: ShellBreakpoint | false;
  labels?: MobileAppBarLabels;
}

// A bare glyph has no border of its own, so it needs a rounded box for the ring to trace.
const BACK =
  "-ml-1 flex size-6 shrink-0 items-center justify-center rounded-md text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring";

const HIDE_FROM = { md: "md:hidden", lg: "lg:hidden" } as const;

/**
 * The bar that titles a screen on a phone. A root screen puts the title flush
 * left with an optional action; a pushed one (`back`) centres it between the
 * back control and a matching spacer. Sticks under `--ev-shell-offset` and
 * arrives with the screen (`data-enter="rise"`), one step ahead of a
 * `PageFrame`'s sections.
 */
export function MobileAppBar({
  title,
  back,
  right,
  linkComponent,
  hideFrom = "lg",
  labels = {},
  className,
  ...props
}: MobileAppBarProps) {
  const backLabel = labels.back ?? "Back";
  const Link = linkComponent ?? "a";
  return (
    <header
      data-slot="mobile-app-bar"
      data-enter="rise"
      className={cn(
        "sticky top-[var(--ev-shell-offset,0px)] z-30 flex items-center gap-2 border-b border-border bg-secondary px-4 pb-3.5 pt-4",
        hideFrom && HIDE_FROM[hideFrom],
        className,
      )}
      {...props}
    >
      {back &&
        ("href" in back ? (
          <Link href={back.href} aria-label={backLabel} className={BACK}>
            <ChevronLeftIcon className="size-6" />
          </Link>
        ) : (
          <button type="button" onClick={back.onClick} aria-label={backLabel} className={BACK}>
            <ChevronLeftIcon className="size-6" />
          </button>
        ))}
      <h1
        className={cn(
          "min-w-0 flex-1 truncate font-semibold text-ink",
          back ? "text-center text-base" : "text-lg",
        )}
      >
        {title}
      </h1>
      {back && right === undefined ? <span className="size-6 shrink-0" aria-hidden /> : right}
    </header>
  );
}
