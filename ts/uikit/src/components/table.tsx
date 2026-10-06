import * as React from "react";
import { cn } from "../lib/cn";
import {
  TABLE,
  TABLE_BODY,
  TABLE_CAPTION,
  TABLE_CARD,
  TABLE_CELL,
  TABLE_CONTAINER,
  TABLE_FOOTER,
  TABLE_HEAD,
  TABLE_HEADER,
  TABLE_ROW,
  tableAligns,
  tableDensities,
  tableVariants,
  type TableAlign,
  type TableDensity,
  type TableVariant,
} from "../generated/table";

export type { TableAlign, TableDensity, TableVariant };

export interface TableProps extends React.ComponentProps<"table"> {
  variant?: TableVariant;
  density?: TableDensity;
}

// `variant` and `density` only set inherited `--table-*` properties that the
// heads and cells read — no context, so `Table` stays a Server Component and a
// cell's own `className` still beats the table's geometry.
export function Table({ variant = "default", density = "default", className, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      className={TABLE_CONTAINER}
    >
      <table
        data-slot="table"
        data-variant={variant}
        data-density={density}
        className={cn(TABLE, tableVariants[variant], tableDensities[density], className)}
        {...props}
      />
    </div>
  );
}

/** The surface a `variant="card"` table sits in, edge to edge. */
export function TableCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-card"
      className={cn(TABLE_CARD, className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(TABLE_HEADER, className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(TABLE_BODY, className)}
      {...props}
    />
  );
}

export function TableFooter({
  className,
  ...props
}: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(TABLE_FOOTER, className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(TABLE_ROW, className)}
      {...props}
    />
  );
}

// The HTML `align` attribute is obsolete; the prop takes its name for the
// logical start/end the Rust port uses.
export interface TableHeadProps extends Omit<React.ComponentProps<"th">, "align"> {
  align?: TableAlign;
}

export function TableHead({ align, className, ...props }: TableHeadProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(TABLE_HEAD, align && tableAligns[align], className)}
      {...props}
    />
  );
}

export interface TableCellProps extends Omit<React.ComponentProps<"td">, "align"> {
  align?: TableAlign;
}

export function TableCell({ align, className, ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(TABLE_CELL, align && tableAligns[align], className)}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn(TABLE_CAPTION, className)}
      {...props}
    />
  );
}
