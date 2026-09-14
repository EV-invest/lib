//! The trading terminal: an order book over an investment product's shares,
//! laid out the way a spot exchange does it — ticker on top, chart | book |
//! order form across the middle, the trader's own orders underneath.
//!
//! Every surface here is a slot. The chart is a sized `relative` box for a
//! consumer-chosen plotting engine, the open-orders pane is a `table`, the
//! tabs over it are `tabs`; the kit contributes the frame and the two things a
//! generic table cannot do — a depth bar behind a price level and a side colour
//! that reads the same in both ports.

use tailwind_fuse::{AsTailwindClass, TwVariant};

/// The frame. Stacked on a phone in DOM order; from `lg` a three-column grid
/// bound to the viewport, so every pane scrolls inside itself rather than the
/// page. The height subtracts `--ev-shell-offset` so a hosting shell's chrome
/// is not double-counted. `gap-px` over a `bg-border` ground draws the hairlines
/// between panes without a border on each.
pub const TERMINAL_ROOT: &str = "grid w-full grid-cols-1 gap-px bg-border text-ink text-sm \
                                 lg:h-[calc(100dvh-var(--ev-shell-offset,0px))] lg:grid-cols-[minmax(0,1fr)_18rem_20rem] \
                                 lg:grid-rows-[auto_minmax(0,1fr)_14rem]";

/// Where a pane sits in the [`TERMINAL_ROOT`] grid. Explicit placement, so the
/// desktop layout does not depend on the order a consumer emits the panes in.
#[derive(Debug, PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum TerminalArea {
	#[tw(default, class = "lg:col-span-3 lg:row-start-1")]
	Ticker,
	#[tw(class = "lg:col-start-1 lg:row-start-2")]
	Chart,
	#[tw(class = "lg:col-start-2 lg:row-start-2")]
	Book,
	#[tw(class = "lg:col-start-3 lg:row-start-2")]
	Form,
	#[tw(class = "lg:col-span-3 lg:row-start-3")]
	Orders,
}

pub const TERMINAL_PANE: &str = "flex min-h-0 min-w-0 flex-col overflow-hidden bg-card";

pub const TERMINAL_PANE_HEADER: &str = "flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-xs font-medium text-ink-mid";

pub const TERMINAL_PANE_BODY: &str = "flex min-h-0 flex-1 flex-col overflow-auto";

/// The slot a plotting engine mounts into: sized, `relative`, nothing drawn.
/// A chart library measures its host, so the host must have a height before
/// the library runs — hence the floor.
pub const TERMINAL_CHART: &str = "relative min-h-[18rem] flex-1 overflow-hidden";

/// The strip across the top. Scrolls sideways rather than wrapping: a stat
/// that wraps under another is misread as its label.
pub const TERMINAL_TICKER: &str = "flex min-w-0 items-center gap-6 overflow-x-auto bg-card px-4 py-2 whitespace-nowrap";

pub const TERMINAL_TICKER_STAT: &str = "flex shrink-0 flex-col gap-0.5";

pub const TERMINAL_TICKER_LABEL: &str = "text-[11px] uppercase tracking-wide text-ink-soft";

pub const TERMINAL_TICKER_VALUE: &str = "font-mono text-sm tabular-nums text-ink";

/// Which side of the book a level or a print belongs to. Bids read positive,
/// asks read loud — the row's text colour; the depth bar takes its tint from
/// [`book_depth_class`].
#[derive(Debug, PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum BookSide {
	#[tw(default, class = "text-positive")]
	Bid,
	#[tw(class = "text-accent-error")]
	Ask,
}

/// The depth bar's fill for a side — the side colour at low alpha, so the
/// figures over it stay legible.
pub fn book_depth_class(side: BookSide) -> &'static str {
	match side {
		BookSide::Bid => "bg-positive/15",
		BookSide::Ask => "bg-accent-error/15",
	}
}

pub const ORDER_BOOK: &str = "flex min-h-0 flex-1 flex-col font-mono text-xs tabular-nums";

/// Column captions: price / size / total, right-aligned like the figures under
/// them, except the price column.
pub const ORDER_BOOK_HEAD: &str = "grid shrink-0 grid-cols-3 gap-2 px-3 py-1.5 text-right text-[11px] text-ink-soft [&>*:first-child]:text-left";

/// One price level. `isolate` starts a stacking context so the depth bar's
/// negative `z-index` sits between this row's own background (and its hover
/// wash) and the figures, instead of vanishing behind the pane.
pub const ORDER_BOOK_ROW: &str = "relative isolate grid cursor-pointer grid-cols-3 gap-2 px-3 py-0.5 text-right leading-5 hover:bg-hover";

/// The price cell of a level or a print; takes its colour from [`BookSide`].
pub const ORDER_BOOK_PRICE: &str = "text-left";

/// The bar behind a level, anchored right and sized by the consumer
/// (`style="width: 42%"`), tinted by [`book_depth_class`].
pub const ORDER_BOOK_DEPTH: &str = "pointer-events-none absolute inset-y-0 right-0 -z-10";

/// The mid / spread line between asks and bids.
pub const ORDER_BOOK_SPREAD: &str = "flex shrink-0 items-center justify-between gap-2 border-y border-border bg-muted/50 px-3 py-1 text-ink-mid";

/// One print in the trades tape: price / size / time, the price coloured by
/// the aggressor's [`BookSide`].
pub const TRADES_TAPE_ROW: &str = "grid grid-cols-3 gap-2 px-3 py-0.5 text-right font-mono text-xs leading-5 tabular-nums hover:bg-hover";

pub const ORDER_FORM: &str = "flex flex-col gap-3 p-3 text-sm";

/// A label / figure line in the order summary (cost, fee, available balance).
pub const ORDER_FORM_ROW: &str = "flex items-center justify-between gap-2 text-xs";

pub const ORDER_FORM_LABEL: &str = "text-ink-soft";

pub const ORDER_FORM_VALUE: &str = "font-mono tabular-nums text-ink";

/// The submit button's geometry; colour is [`OrderSide`]. Not a `Button`
/// variant because the kit's `Destructive` names a consequence, and selling is
/// not one — it is the other half of the same intent.
pub const ORDER_FORM_SUBMIT_BASE: &str = "inline-flex h-10 w-full shrink-0 cursor-pointer items-center justify-center rounded-[var(--control-radius)] \
                                          text-sm font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 \
                                          disabled:pointer-events-none disabled:opacity-50";

/// The intent behind the submit: filled positive for a buy, filled loud for a
/// sell, each with the ink that reads on that fill.
#[derive(Debug, PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum OrderSide {
	#[tw(default, class = "bg-positive text-on-positive hover:bg-positive/90")]
	Buy,
	#[tw(class = "bg-accent-error text-on-accent-error hover:bg-accent-error/90")]
	Sell,
}

/// The open-orders pane when there is nothing in it. A trader with no orders
/// is the common case, so this reads as calm, not as an error.
pub const OPEN_ORDERS_EMPTY: &str = "flex flex-1 items-center justify-center p-6 text-sm text-ink-soft";
