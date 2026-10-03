import type * as React from "react";

/**
 * How a {@link NavItem} decides it is the current one.
 *
 * - `"prefix"` (default) — the path is the item's own or lies beneath it, on a
 *   segment boundary: `/invest` claims `/invest/arb` but not `/investors`. An
 *   item at `/` is exact, or it would claim every page.
 * - `"exact"` — the path is the item's own and nothing beneath it.
 * - a function — whatever it answers for the path.
 */
export type NavMatch = "exact" | "prefix" | ((pathname: string) => boolean);

/** State a row is rendered in; what `trailing` and `renderItem` are told. */
export interface NavItemState {
  active: boolean;
  /** Marked by a click whose navigation has not landed yet. */
  pending: boolean;
}

/** One destination, shared by the rail ({@link ShellNav}) and the tab bar. */
export interface NavItem {
  /** Stable key; also what `onNavigate` / `onItemIntent` hand back. */
  id: string;
  href: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** A count (`NavBadge`, capped at 99+, `0` draws nothing) or your own node. */
  badge?: number | React.ReactNode;
  /** Anything after the label — a status chip; a function is told the row's state. */
  trailing?: React.ReactNode | ((state: NavItemState) => React.ReactNode);
  /**
   * Leaves the app: rendered as a plain `<a>` (never `linkComponent`), never
   * current, never marked pending — a `mailto:`, a docs site.
   */
  external?: boolean;
  /** Passed to the anchor; `_blank` gets `rel="noopener noreferrer"`. */
  target?: React.HTMLAttributeAnchorTarget;
  match?: NavMatch;
  /**
   * More paths this item claims, prefix-matched — the one tab standing in for
   * a whole group of rail rows (`["/profile", "/notifications"]`).
   */
  also?: readonly string[];
  /** Rendered, not focusable, never current. */
  disabled?: boolean;
}

/** A titled run of items; the rail draws one marker per group. */
export interface NavGroup {
  id: string;
  /** The eyebrow above the rows; also the list's accessible name. */
  label?: React.ReactNode;
  items: readonly NavItem[];
}

function pathOf(href: string): string {
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function underPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// An exact hit outranks any prefix; among prefixes the longest wins. A function
// match ranks as a prefix hit on the item's own href.
const EXACT = Number.MAX_SAFE_INTEGER;

/**
 * How strongly `item` claims `pathname`, or `null` when it does not. Used to
 * pick ONE current item when several match — the rail and the tab bar each
 * draw a single marker, so two current rows is not a state they can show.
 */
export function navItemMatch(item: NavItem, pathname: string): number | null {
  if (item.external || item.disabled) return null;
  const path = pathOf(pathname);
  const own = pathOf(item.href);
  const match = item.match ?? "prefix";
  let score: number | null = null;
  if (typeof match === "function") score = match(path) ? own.length : null;
  else if (path === own) score = EXACT;
  else if (match === "prefix" && underPrefix(path, own)) score = own.length;
  for (const extra of item.also ?? []) {
    const p = pathOf(extra);
    if (underPrefix(path, p) && (score === null || p.length > score)) score = p.length;
  }
  return score;
}

/** Whether `item` claims `pathname` at all, regardless of its neighbours. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return navItemMatch(item, pathname) !== null;
}

/** The single current item for `pathname`: the strongest claim, ties to the first. */
export function resolveActiveNavItem(
  items: Iterable<NavItem>,
  pathname: string,
): NavItem | undefined {
  let best: NavItem | undefined;
  let bestScore = -1;
  for (const item of items) {
    const score = navItemMatch(item, pathname);
    if (score !== null && score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

/**
 * A click the app should handle in place. A modified or non-primary click opens
 * the page elsewhere (a tab, a window, the context menu) and the router lets the
 * browser have it, so the current row stays current; `defaultPrevented` is the
 * same courtesy to anything upstream that claimed the click.
 */
export function isPlainLeftClick(e: React.MouseEvent): boolean {
  return !(e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}

/** Props the rail and the tab bar hand a `linkComponent`; `next/link` takes all of them. */
export function anchorTargetProps(
  item: Pick<NavItem, "target">,
): { target?: React.HTMLAttributeAnchorTarget; rel?: string } {
  if (item.target === undefined) return {};
  return item.target === "_blank"
    ? { target: item.target, rel: "noopener noreferrer" }
    : { target: item.target };
}
