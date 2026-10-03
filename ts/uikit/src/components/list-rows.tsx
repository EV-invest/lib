import * as React from "react";
import { cn } from "../lib/cn";

// The phone form of a table: a list of label/value rows split by hairlines.
// A table scrolled sideways on a phone hides the trailing columns — usually the
// date and the action, the reason the list was opened. TS-only (README
// "Limitations").

export type ListRowsVariant = "plain" | "card";

const LIST_ROWS = "flex w-full min-w-0 flex-col divide-y divide-border";

// `plain` sits in a container that already pads (a padded card, a section);
// `card` is edge to edge in a `TableCard`, so the rows pad themselves and the
// hairlines run the card's full width. The inset travels as a custom property,
// as the table's cell padding does, so a row's own `px-*` still wins.
const listRowsVariants: Record<ListRowsVariant, string> = {
  plain: "",
  card: "[--ev-list-row-x:1rem]",
};

export interface ListRowsProps extends React.ComponentProps<"ul"> {
  variant?: ListRowsVariant;
}

export function ListRows({ variant = "plain", className, ...props }: ListRowsProps) {
  return (
    <ul
      data-slot="list-rows"
      data-variant={variant}
      className={cn(LIST_ROWS, listRowsVariants[variant], className)}
      {...props}
    />
  );
}

const LIST_ROW = "flex min-w-0 items-center justify-between gap-3 px-[var(--ev-list-row-x,0px)] py-3";

// `<li value>` is an ordinal for `<ol>`; in an unordered list of rows the name
// is far more useful for the trailing figure.
export interface ListRowProps extends Omit<React.ComponentProps<"li">, "value"> {
  /** The row's title. Omit it (and `value`) to lay the row out yourself. */
  label?: React.ReactNode;
  /** A caption a step down under the label. */
  description?: React.ReactNode;
  /** Trailing value, right-aligned and truncated rather than pushing the row wide. */
  value?: React.ReactNode;
}

/**
 * One row: label (and description) leading, value trailing, then `children`
 * (a badge, an action). With neither `label` nor `value` the children are the
 * whole row.
 */
export function ListRow({ label, description, value, className, children, ...props }: ListRowProps) {
  return (
    <li
      data-slot="list-row"
      className={cn(LIST_ROW, className)}
      {...props}
    >
      {(label != null || description != null) && (
        <ListRowLabel description={description}>{label}</ListRowLabel>
      )}
      {value != null && <ListRowValue>{value}</ListRowValue>}
      {children}
    </li>
  );
}

export interface ListRowLabelProps extends Omit<React.ComponentProps<"div">, "title"> {
  description?: React.ReactNode;
}

/** The leading block on its own, for a row you compose by hand. */
export function ListRowLabel({ description, className, children, ...props }: ListRowLabelProps) {
  return (
    <div
      data-slot="list-row-label"
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
      {...props}
    >
      <span className="text-sm font-medium text-ink">{children}</span>
      {description != null && (
        <span
          data-slot="list-row-description"
          className="text-xs leading-snug text-ink-soft"
        >
          {description}
        </span>
      )}
    </div>
  );
}

/**
 * The trailing value. It shares the label's type step, so the muted tone and
 * the lighter weight are what keep the label reading first; digits are tabular
 * so a figure in one row lines up with the next.
 */
export function ListRowValue({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="list-row-value"
      className={cn("min-w-0 truncate text-right text-sm tabular-nums text-ink-soft", className)}
      {...props}
    />
  );
}
