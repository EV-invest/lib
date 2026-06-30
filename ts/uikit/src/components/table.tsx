import * as React from "react";
import { cn } from "../lib/cn";
import {
  TABLE,
  TABLE_BODY,
  TABLE_CAPTION,
  TABLE_CELL,
  TABLE_CONTAINER,
  TABLE_FOOTER,
  TABLE_HEAD,
  TABLE_HEADER,
  TABLE_ROW,
} from "../generated/table";

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className={TABLE_CONTAINER}
    >
      <table
        data-slot="table"
        className={cn(TABLE, className)}
        {...props}
      />
    </div>
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

export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(TABLE_HEAD, className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(TABLE_CELL, className)}
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
