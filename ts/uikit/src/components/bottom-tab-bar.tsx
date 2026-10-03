"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { NavBadge } from "./nav-badge";
import { labelTitle, NavLink, type NavLinkCallbacks } from "./nav-link";
import { resolveActiveNavItem, type NavItem } from "./nav-model";
import { usePendingNavigation } from "./use-shell-nav";

export interface BottomTabBarLabels {
  /** Accessible name of the bar. Default `"Main"`. */
  nav?: string;
  /** Spoken text of a numeric badge, given the real count. Default `"{n} new"`. */
  badge?: (count: number) => string;
}

export interface BottomTabBarProps
  extends Omit<React.ComponentProps<"nav">, "children">,
    NavLinkCallbacks {
  /**
   * The tabs, in order. Five is the most a phone holds — every label gets a
   * fifth of ~390px. A tab standing in for several rail rows lists their paths
   * in `also`. `trailing` is not drawn here; `badge` sits on the icon's corner.
   */
  items: readonly NavItem[];
  pathname: string;
  linkComponent?: React.ElementType;
  labels?: BottomTabBarLabels;
}

/**
 * The mobile tab bar: equal tabs, one rule that slides between them, and a
 * corner badge. Position-agnostic — `AppShell` pins it to the bottom of the
 * viewport and hides it from its breakpoint up; the bar itself reserves the
 * bottom safe area under its `--shell-tab-bar-h`.
 *
 * The rule is a single node translated by whole tab widths (it is exactly one
 * tab wide, so the two cannot drift); on a route no tab claims it fades out
 * where it stands. That is why each tab is `min-w-0`: a long label must
 * truncate, never widen its tab off the rule's arithmetic.
 */
export function BottomTabBar({
  items,
  pathname,
  linkComponent,
  onItemIntent,
  onNavigate,
  labels = {},
  className,
  ...props
}: BottomTabBarProps) {
  const [pendingId, markPending] = usePendingNavigation(pathname);
  const currentId =
    (pendingId !== null && items.some((i) => i.id === pendingId) ? pendingId : undefined) ??
    resolveActiveNavItem(items, pathname)?.id;
  const at = items.findIndex((i) => i.id === currentId);
  return (
    <nav
      data-slot="tab-bar"
      aria-label={labels.nav ?? "Main"}
      className={cn(
        "relative box-content flex h-(--shell-tab-bar-h) items-center border-t border-border bg-secondary px-2 pb-[env(safe-area-inset-bottom,0px)]",
        className,
      )}
      {...props}
    >
      <span
        data-slot="tab-bar-marker"
        data-state={at >= 0 ? "active" : "idle"}
        aria-hidden
        className="pointer-events-none absolute left-2 top-0 flex justify-center"
        // `left-2` + `1rem` restate the bar's `px-2`: the rule is one tab wide.
        style={{
          width: `calc((100% - 1rem) / ${Math.max(items.length, 1)})`,
          translate: `${Math.max(at, 0) * 100}% 0`,
        }}
      >
        <span className="h-0.5 w-10 rounded-full bg-primary-ink" />
      </span>
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === currentId;
        return (
          <NavLink
            key={item.id}
            item={item}
            current={active}
            pending={item.id === pendingId}
            linkComponent={linkComponent}
            markPending={markPending}
            onItemIntent={onItemIntent}
            onNavigate={onNavigate}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary",
              active ? "text-primary-ink" : "text-ink-soft hover:text-ink",
              item.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <span className="relative shrink-0">
              {Icon ? <Icon className="size-5" /> : <span className="block size-5" />}
              {typeof item.badge === "number" ? (
                <NavBadge
                  count={item.badge}
                  variant="corner"
                  {...(labels.badge ? { label: labels.badge } : {})}
                />
              ) : (
                item.badge
              )}
            </span>
            <span className="w-full truncate text-center text-xs" title={labelTitle(item.label)}>
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
