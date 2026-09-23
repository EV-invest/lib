"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import {
  bookDepthClasses,
  bookSideClasses,
  OPEN_ORDERS_EMPTY,
  ORDER_BOOK,
  ORDER_BOOK_DEPTH,
  ORDER_BOOK_HEAD,
  ORDER_BOOK_PRICE,
  ORDER_BOOK_ROW,
  ORDER_BOOK_SPREAD,
  ORDER_FORM,
  ORDER_FORM_LABEL,
  ORDER_FORM_ROW,
  ORDER_FORM_SUBMIT_BASE,
  ORDER_FORM_VALUE,
  orderSideClasses,
  TERMINAL_CHART,
  TERMINAL_PANE,
  TERMINAL_PANE_BODY,
  TERMINAL_PANE_HEADER,
  TERMINAL_ROOT,
  TERMINAL_TICKER,
  TERMINAL_TICKER_LABEL,
  TERMINAL_TICKER_STAT,
  TERMINAL_TICKER_VALUE,
  terminalAreaClasses,
  TRADES_TAPE_ROW,
  type BookSide,
  type OrderSide,
  type TerminalArea,
} from "../generated/terminal";

export type { BookSide, OrderSide, TerminalArea };

/**
 * The trading terminal — an order book over an investment product's shares,
 * laid out like a spot exchange: ticker, then chart | book | order form, then
 * the trader's own orders. Every pane is a slot; the chart host is empty on
 * purpose (the plotting engine is the consumer's), the open-orders table is
 * `Table`, the tabs over it are `Tabs`.
 */

/**
 * The frame: a phone stacks the panes in DOM order, `lg` and up places them
 * by `TerminalArea` on a viewport-bound grid.
 */
export function Terminal({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="terminal" className={cn(TERMINAL_ROOT, className)} {...props} />;
}

export interface TerminalPaneProps extends React.ComponentProps<"section"> {
  area: TerminalArea;
}

/**
 * One cell of the frame. `area` is where it sits on the desktop grid;
 * `TerminalPaneHeader` and `TerminalPaneBody` go inside.
 */
export function TerminalPane({ area, className, ...props }: TerminalPaneProps) {
  return (
    <section
      data-slot="terminal-pane"
      data-area={area}
      className={cn(TERMINAL_PANE, terminalAreaClasses[area], className)}
      {...props}
    />
  );
}

export function TerminalPaneHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="terminal-pane-header"
      className={cn(TERMINAL_PANE_HEADER, className)}
      {...props}
    />
  );
}

/** The scrolling part of a pane. */
export function TerminalPaneBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="terminal-pane-body" className={cn(TERMINAL_PANE_BODY, className)} {...props} />
  );
}

/**
 * The sized host a plotting engine mounts into. Renders nothing itself; a
 * consumer mounts its chart on the element (via `ref`) or fills it with
 * children. `forwardRef` rather than a `ref` prop so the handle also reaches
 * the element under React 18, where function components drop `ref`.
 */
export const TerminalChart = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(function TerminalChart({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="terminal-chart"
      className={cn(TERMINAL_CHART, className)}
      {...props}
    />
  );
});

/**
 * The strip across the top; holds `TickerStat`s. Already placed in the
 * `ticker` slot.
 */
export function TerminalTicker({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="terminal-ticker"
      data-area="ticker"
      className={cn(TERMINAL_TICKER, terminalAreaClasses.ticker, className)}
      {...props}
    />
  );
}

export interface TickerStatProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  value: React.ReactNode;
}

/**
 * A labelled figure in the ticker. `className` lands on the figure, so a
 * change figure passes its valence colour there.
 */
export function TickerStat({ label, value, className, ...props }: TickerStatProps) {
  return (
    <div data-slot="ticker-stat" className={TERMINAL_TICKER_STAT} {...props}>
      <span className={TERMINAL_TICKER_LABEL}>{label}</span>
      <span className={cn(TERMINAL_TICKER_VALUE, className)}>{value}</span>
    </div>
  );
}

/** The book: `OrderBookHead`, then ask rows, `OrderBookSpread`, bid rows. */
export function OrderBook({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="order-book" className={cn(ORDER_BOOK, className)} {...props} />;
}

export interface OrderBookHeadProps extends Omit<React.ComponentProps<"div">, "children"> {
  price: React.ReactNode;
  size: React.ReactNode;
  total: React.ReactNode;
}

/** The three column captions — price, size, total — in the consumer's words. */
export function OrderBookHead({ price, size, total, className, ...props }: OrderBookHeadProps) {
  return (
    <div data-slot="order-book-head" className={cn(ORDER_BOOK_HEAD, className)} {...props}>
      <span>{price}</span>
      <span>{size}</span>
      <span>{total}</span>
    </div>
  );
}

export interface OrderBookRowProps extends Omit<React.ComponentProps<"div">, "children"> {
  side: BookSide;
  price: React.ReactNode;
  size: React.ReactNode;
  total: React.ReactNode;
  /**
   * This level's cumulative size as a fraction of the deepest level shown
   * (`0..=1`); it sizes the bar behind the figures.
   */
  depth?: number;
}

/** One price level. */
export function OrderBookRow({
  side,
  price,
  size,
  total,
  depth = 0,
  className,
  ...props
}: OrderBookRowProps) {
  return (
    <div
      data-slot="order-book-row"
      data-side={side}
      className={cn(ORDER_BOOK_ROW, className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(ORDER_BOOK_DEPTH, bookDepthClasses[side])}
        style={{ width: `${depthPercent(depth)}%` }}
      />
      <span className={cn(ORDER_BOOK_PRICE, bookSideClasses[side])}>{price}</span>
      <span>{size}</span>
      <span>{total}</span>
    </div>
  );
}

/**
 * The bar is a CSS percentage, so the fraction is clamped and rounded once
 * here; a NaN from an empty book reads as no depth rather than as `NaN%`.
 */
function depthPercent(depth: number): number {
  if (Number.isNaN(depth)) return 0;
  return Math.round(Math.min(1, Math.max(0, depth)) * 100);
}

/**
 * The line between asks and bids: the consumer passes the mid and the spread
 * as it wants them formatted.
 */
export function OrderBookSpread({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="order-book-spread" className={cn(ORDER_BOOK_SPREAD, className)} {...props} />
  );
}

export interface TradesTapeRowProps extends Omit<React.ComponentProps<"div">, "children"> {
  side: BookSide;
  price: React.ReactNode;
  size: React.ReactNode;
  time: React.ReactNode;
}

/** One print in the tape: price coloured by the aggressor's side, then size and time. */
export function TradesTapeRow({ side, price, size, time, className, ...props }: TradesTapeRowProps) {
  return (
    <div
      data-slot="trades-tape-row"
      data-side={side}
      className={cn(TRADES_TAPE_ROW, className)}
      {...props}
    >
      <span className={cn(ORDER_BOOK_PRICE, bookSideClasses[side])}>{price}</span>
      <span>{size}</span>
      <span>{time}</span>
    </div>
  );
}

/**
 * The order form. Owns no state: the consumer wires the inputs and handles
 * `onSubmit`; the default is prevented here so a submit never navigates.
 */
export function OrderForm({ className, onSubmit, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      data-slot="order-form"
      className={cn(ORDER_FORM, className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(e);
      }}
      {...props}
    />
  );
}

export interface OrderFormRowProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  value: React.ReactNode;
}

/** A label / figure line in the order summary — cost, fee, what is available. */
export function OrderFormRow({ label, value, className, ...props }: OrderFormRowProps) {
  return (
    <div data-slot="order-form-row" className={cn(ORDER_FORM_ROW, className)} {...props}>
      <span className={ORDER_FORM_LABEL}>{label}</span>
      <span className={ORDER_FORM_VALUE}>{value}</span>
    </div>
  );
}

export interface OrderFormSubmitProps extends Omit<React.ComponentProps<"button">, "type"> {
  side?: OrderSide;
}

/** The submit, filled in the colour of the intent. */
export function OrderFormSubmit({ side = "buy", className, ...props }: OrderFormSubmitProps) {
  return (
    <button
      type="submit"
      data-slot="order-form-submit"
      data-side={side}
      className={cn(ORDER_FORM_SUBMIT_BASE, orderSideClasses[side], className)}
      {...props}
    />
  );
}

/** The open-orders pane with nothing in it. */
export function OpenOrdersEmpty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="open-orders-empty" className={cn(OPEN_ORDERS_EMPTY, className)} {...props} />
  );
}
