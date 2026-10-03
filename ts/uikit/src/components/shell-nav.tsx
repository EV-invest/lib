"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { NavBadge } from "./nav-badge";
import { labelTitle, NavLink, type NavLinkCallbacks } from "./nav-link";
import { resolveActiveNavItem, type NavGroup, type NavItem, type NavItemState } from "./nav-model";
import { usePendingNavigation, useSlideMarker } from "./use-shell-nav";

export interface ShellNavLabels {
  /** Accessible name of the nav holding `groups`. Default `"Main"`. */
  primary?: string;
  /** Accessible name of the nav holding `footerGroups`. Default `"Account"`. */
  footer?: string;
  /** Spoken text of a numeric badge, given the real count. Default `"{n} new"`. */
  badge?: (count: number) => string;
}

export interface ShellNavProps
  extends Omit<React.ComponentProps<"aside">, "children">,
    NavLinkCallbacks {
  groups: readonly NavGroup[];
  /** Pinned to the bottom of the rail (profile, notifications, settings). */
  footerGroups?: readonly NavGroup[];
  /** The router's current path — `usePathname()` in Next. */
  pathname: string;
  /** Your router's link (`next/link`); defaults to a plain `<a>`. */
  linkComponent?: React.ElementType;
  /** Above the groups — the brand lock-up. */
  header?: React.ReactNode;
  /** Below the footer groups — the signed-in account, a sign-out. */
  footer?: React.ReactNode;
  /** Replaces a row's content (icon, label, badge); the link, `aria-current` and the marker stay the kit's. */
  renderItem?: (item: NavItem, state: NavItemState) => React.ReactNode;
  labels?: ShellNavLabels;
}

// The ring is the solid token, never a tint — at 50% it composites under the 3:1
// non-text floor. The offset keeps it legible around the marked row, whose fill
// is that same hue.
const NAV_FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary";
const ROW = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";

/**
 * The app's left rail: data-driven groups, a footer block pinned to the bottom,
 * one sliding marker per group, and an optimistic mark on click so the row
 * answers the click rather than the router's round-trip.
 *
 * Exactly one row across the rail is current — the strongest claim on the path
 * (see {@link resolveActiveNavItem}) — so overlapping `prefix` items are safe.
 * Visibility (roles, flags) is the caller's: pass only the items to show.
 */
export function ShellNav({
  groups,
  footerGroups = [],
  pathname,
  linkComponent,
  header,
  footer,
  renderItem,
  onItemIntent,
  onNavigate,
  labels = {},
  className,
  ...props
}: ShellNavProps) {
  const [pendingId, markPending] = usePendingNavigation(pathname);
  const all = [...groups, ...footerGroups].flatMap((g) => g.items);
  const currentId =
    (pendingId !== null && all.some((i) => i.id === pendingId) ? pendingId : undefined) ??
    resolveActiveNavItem(all, pathname)?.id;
  const section = (group: NavGroup) => (
    <ShellNavSection
      key={group.id}
      group={group}
      currentId={currentId}
      pendingId={pendingId}
      row={{ linkComponent, markPending, onItemIntent, onNavigate, renderItem, badgeLabel: labels.badge }}
    />
  );
  return (
    <aside
      data-slot="shell-nav"
      className={cn(
        "flex h-full w-(--shell-rail-w) flex-col gap-7 overflow-y-auto border-r border-border bg-secondary px-4.5 pb-5 pt-6",
        className,
      )}
      {...props}
    >
      {header}
      <nav aria-label={labels.primary ?? "Main"} className="flex flex-col gap-4.5">
        {groups.map(section)}
      </nav>
      <div className="flex-1" />
      {footerGroups.length > 0 && (
        <nav aria-label={labels.footer ?? "Account"} className="flex flex-col gap-4.5">
          {footerGroups.map(section)}
        </nav>
      )}
      {footer}
    </aside>
  );
}

interface RowContext extends NavLinkCallbacks {
  linkComponent: React.ElementType | undefined;
  markPending: (id: string) => void;
  renderItem: ShellNavProps["renderItem"];
  badgeLabel: ((count: number) => string) | undefined;
}

// One marker node per SECTION, mounted once and moved — not one per rail: a
// marker travelling between groups would cross headings that have nothing to do
// with either row. Crossing groups unmounts one marker and mounts another (a
// fade). `isolate` is load-bearing: the marker sits on a negative z-index and
// without its own stacking context would land behind the rail's background.
function ShellNavSection({
  group,
  currentId,
  pendingId,
  row,
}: {
  group: NavGroup;
  currentId: string | undefined;
  pendingId: string | null;
  row: RowContext;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const labelId = React.useId();
  const at = group.items.some((i) => i.id === currentId) ? (currentId ?? null) : null;
  useSlideMarker(root, at);
  return (
    <div
      ref={root}
      data-slot="shell-nav-section"
      className={cn("relative isolate flex flex-col gap-1", group.label !== undefined && "pl-1")}
    >
      {/* First in DOM order: the pre-hydration fill in motion.css reaches the marked
          row through a sibling combinator, which only looks forward. */}
      {at !== null && (
        <span
          data-slot="shell-nav-marker"
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 -z-10 rounded-lg bg-primary"
        />
      )}
      {group.label !== undefined && (
        <p id={labelId} className="mb-0.5 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          {group.label}
        </p>
      )}
      <ul
        aria-labelledby={group.label !== undefined ? labelId : undefined}
        className="flex flex-col gap-1"
      >
        {group.items.map((item) => (
          <li key={item.id} className="flex flex-col">
            <ShellNavRow
              item={item}
              state={{ active: item.id === currentId, pending: item.id === pendingId }}
              row={row}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShellNavRow({ item, state, row }: { item: NavItem; state: NavItemState; row: RowContext }) {
  const Icon = item.icon;
  const trailing = typeof item.trailing === "function" ? item.trailing(state) : item.trailing;
  return (
    <NavLink
      item={item}
      current={state.active}
      pending={state.pending}
      linkComponent={row.linkComponent}
      markPending={row.markPending}
      onItemIntent={row.onItemIntent}
      onNavigate={row.onNavigate}
      title={labelTitle(item.label)}
      className={cn(
        ROW,
        NAV_FOCUS,
        state.active ? "font-semibold text-on-primary" : "font-medium text-ink hover:bg-hover",
        item.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
    >
      {row.renderItem ? (
        row.renderItem(item, state)
      ) : (
        <>
          {Icon && <Icon className="size-4.5 shrink-0" />}
          {/* `min-w-0`: without it the label refuses to shrink below its own text and
              the rail widens to the longest translation instead of truncating. */}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {typeof item.badge === "number" ? (
            <NavBadge
              count={item.badge}
              active={state.active}
              {...(row.badgeLabel ? { label: row.badgeLabel } : {})}
            />
          ) : (
            item.badge
          )}
          {trailing}
        </>
      )}
    </NavLink>
  );
}
