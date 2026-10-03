import * as React from "react";
import { cn } from "../lib/cn";

export type NavBadgeVariant = "pill" | "corner";

export interface NavBadgeProps extends Omit<React.ComponentProps<"span">, "children"> {
  count: number;
  /** Above this the badge shows `{max}+`. */
  max?: number;
  /**
   * The spoken text, given the REAL count — the one figure the cap throws away.
   * Default: `"{n} new"`.
   */
  label?: (count: number) => string;
  /**
   * `pill` sits in a row after the label (the rail); `corner` is the solid dot on
   * an icon's top-right corner (the tab bar) — its parent must be `relative`.
   */
  variant?: NavBadgeVariant;
  /** A pill on the marked row: inverted so it reads on the marker's fill. */
  active?: boolean;
}

const PILL = "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums";
const CORNER =
  "absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold leading-none tabular-nums text-on-primary";

const defaultLabel = (n: number) => `${n} new`;

/**
 * A count on a nav row or tab, capped so a neglected inbox cannot widen the
 * rail. Draws nothing for `0` or less.
 *
 * The visible figure is `aria-hidden` and the spoken one rides in an `sr-only`
 * span rather than an `aria-label`: a label on a plain span is not part of the
 * name the browser computes for the link around it, while text is — so the row
 * reads "Notifications, 150 new".
 */
export function NavBadge({
  count,
  max = 99,
  label = defaultLabel,
  variant = "pill",
  active = false,
  className,
  ...props
}: NavBadgeProps) {
  if (!(count > 0)) return null;
  return (
    <span
      data-slot="nav-badge"
      data-variant={variant}
      className={cn(
        variant === "corner"
          ? CORNER
          : cn(PILL, active ? "bg-background text-ink" : "bg-primary-ink/15 text-primary-ink"),
        className,
      )}
      {...props}
    >
      <span aria-hidden>{count > max ? `${max}+` : count}</span>
      <span className="sr-only">{label(count)}</span>
    </span>
  );
}

export type NavDotTone = "primary" | "positive" | "warn" | "error";

const DOT_TONE: Record<NavDotTone, string> = {
  primary: "bg-primary-ink",
  positive: "bg-positive",
  warn: "bg-accent-warn",
  error: "bg-accent-error",
};

export interface NavDotProps extends Omit<React.ComponentProps<"span">, "children"> {
  tone?: NavDotTone;
  /** Spoken text; without one the dot is decoration and hidden from AT. */
  label?: string;
  /** Pin to an icon's top-right corner (parent `relative`), as the tab bar does. */
  corner?: boolean;
}

/** A presence dot — "something here", no figure. */
export function NavDot({ tone = "primary", label, corner = false, className, ...props }: NavDotProps) {
  return (
    <span
      data-slot="nav-dot"
      aria-hidden={label === undefined ? true : undefined}
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        DOT_TONE[tone],
        corner && "absolute -right-1 -top-0.5",
        className,
      )}
      {...props}
    >
      {label !== undefined && <span className="sr-only">{label}</span>}
    </span>
  );
}
