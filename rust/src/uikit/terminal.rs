//! The trading terminal — an order book over an investment product's shares,
//! laid out like a spot exchange: ticker, then chart | book | order form, then
//! the trader's own orders. Every pane is a slot; the chart host is empty on
//! purpose (the plotting engine is the consumer's), the open-orders table is
//! [`Table`](super::Table), the tabs over it are [`Tabs`](super::Tabs).

use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		BookSide, OPEN_ORDERS_EMPTY, ORDER_BOOK, ORDER_BOOK_DEPTH, ORDER_BOOK_HEAD, ORDER_BOOK_PRICE, ORDER_BOOK_ROW, ORDER_BOOK_SPREAD, ORDER_FORM, ORDER_FORM_LABEL, ORDER_FORM_ROW,
		ORDER_FORM_SUBMIT_BASE, ORDER_FORM_VALUE, OrderSide, TERMINAL_CHART, TERMINAL_PANE, TERMINAL_PANE_BODY, TERMINAL_PANE_HEADER, TERMINAL_ROOT, TERMINAL_TICKER, TERMINAL_TICKER_LABEL,
		TERMINAL_TICKER_STAT, TERMINAL_TICKER_VALUE, TRADES_TAPE_ROW, TerminalArea, book_depth_class,
	},
};

/// The frame: a phone stacks the panes in DOM order, `lg` and up places them
/// by [`TerminalArea`] on a viewport-bound grid.
#[component]
pub fn Terminal(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TERMINAL_ROOT, class);
	rsx! {
		div { class: cls, "data-slot": "terminal", {children} }
	}
}

/// One cell of the frame. `area` is where it sits on the desktop grid;
/// [`TerminalPaneHeader`] and [`TerminalPaneBody`] go inside.
#[component]
pub fn TerminalPane(area: TerminalArea, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TERMINAL_PANE, area.as_class(), class);
	rsx! {
		section { class: cls, "data-slot": "terminal-pane", "data-area": area.as_ref(), {children} }
	}
}

#[component]
pub fn TerminalPaneHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TERMINAL_PANE_HEADER, class);
	rsx! {
		header { class: cls, "data-slot": "terminal-pane-header", {children} }
	}
}

/// The scrolling part of a pane.
#[component]
pub fn TerminalPaneBody(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TERMINAL_PANE_BODY, class);
	rsx! {
		div { class: cls, "data-slot": "terminal-pane-body", {children} }
	}
}

/// The sized host a plotting engine mounts into. Renders nothing itself; a
/// consumer mounts its chart on the element (`id`) or fills it with children.
#[component]
pub fn TerminalChart(#[props(default)] id: Option<String>, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TERMINAL_CHART, class);
	rsx! {
		div { id, class: cls, "data-slot": "terminal-chart", {children} }
	}
}

/// The strip across the top; holds [`TickerStat`]s. Already placed in the
/// [`TerminalArea::Ticker`] slot.
#[component]
pub fn TerminalTicker(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TERMINAL_TICKER, TerminalArea::Ticker.as_class(), class);
	rsx! {
		div { class: cls, "data-slot": "terminal-ticker", "data-area": TerminalArea::Ticker.as_ref(), {children} }
	}
}

/// A labelled figure in the ticker. `class` lands on the figure, so a change
/// figure passes its valence colour there.
#[component]
pub fn TickerStat(label: String, value: String, #[props(default)] class: String) -> Element {
	let value_cls = cn!(TERMINAL_TICKER_VALUE, class);
	rsx! {
		div { class: TERMINAL_TICKER_STAT, "data-slot": "ticker-stat",
			span { class: TERMINAL_TICKER_LABEL, {label} }
			span { class: value_cls, {value} }
		}
	}
}

/// The book: [`OrderBookHead`], then ask rows, [`OrderBookSpread`], bid rows.
#[component]
pub fn OrderBook(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ORDER_BOOK, class);
	rsx! {
		div { class: cls, "data-slot": "order-book", {children} }
	}
}

/// The three column captions — price, size, total — in the consumer's words.
#[component]
pub fn OrderBookHead(price: String, size: String, total: String, #[props(default)] class: String) -> Element {
	let cls = cn!(ORDER_BOOK_HEAD, class);
	rsx! {
		div { class: cls, "data-slot": "order-book-head",
			span { {price} }
			span { {size} }
			span { {total} }
		}
	}
}

/// One price level. `depth` is this level's cumulative size as a fraction of
/// the deepest level shown (`0.0..=1.0`); it sizes the bar behind the figures.
#[component]
pub fn OrderBookRow(
	side: BookSide,
	price: String,
	size: String,
	total: String,
	#[props(default)] depth: f64,
	#[props(default)] class: String,
	onclick: Option<EventHandler<MouseEvent>>,
) -> Element {
	let cls = cn!(ORDER_BOOK_ROW, class);
	let price_cls = cn!(ORDER_BOOK_PRICE, side.as_class());
	let depth_cls = cn!(ORDER_BOOK_DEPTH, book_depth_class(side));
	let width = format!("width: {}%", depth_percent(depth));
	rsx! {
		div {
			class: cls,
			"data-slot": "order-book-row",
			"data-side": side.as_ref(),
			onclick: move |e| { if let Some(h) = onclick { h.call(e); } },
			span { class: depth_cls, style: width, "aria-hidden": "true" }
			span { class: price_cls, {price} }
			span { {size} }
			span { {total} }
		}
	}
}

/// The line between asks and bids: the consumer passes the mid and the spread
/// as it wants them formatted.
#[component]
pub fn OrderBookSpread(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ORDER_BOOK_SPREAD, class);
	rsx! {
		div { class: cls, "data-slot": "order-book-spread", {children} }
	}
}
/// One print in the tape: price coloured by the aggressor's side, then size
/// and time.
#[component]
pub fn TradesTapeRow(side: BookSide, price: String, size: String, time: String, #[props(default)] class: String) -> Element {
	let cls = cn!(TRADES_TAPE_ROW, class);
	let price_cls = cn!(ORDER_BOOK_PRICE, side.as_class());
	rsx! {
		div { class: cls, "data-slot": "trades-tape-row", "data-side": side.as_ref(),
			span { class: price_cls, {price} }
			span { {size} }
			span { {time} }
		}
	}
}
/// The order form. Owns no state: the consumer wires the inputs and handles
/// `onsubmit`; the default is prevented here so a submit never navigates.
#[component]
pub fn OrderForm(#[props(default)] class: String, onsubmit: Option<EventHandler<FormEvent>>, children: Element) -> Element {
	let cls = cn!(ORDER_FORM, class);
	rsx! {
		form {
			class: cls,
			"data-slot": "order-form",
			onsubmit: move |e| {
				e.prevent_default();
				if let Some(h) = onsubmit {
					h.call(e);
				}
			},
			{children}
		}
	}
}
/// A label / figure line in the order summary — cost, fee, what is available.
#[component]
pub fn OrderFormRow(label: String, value: String, #[props(default)] class: String) -> Element {
	let cls = cn!(ORDER_FORM_ROW, class);
	rsx! {
		div { class: cls, "data-slot": "order-form-row",
			span { class: ORDER_FORM_LABEL, {label} }
			span { class: ORDER_FORM_VALUE, {value} }
		}
	}
}
/// The submit, filled in the colour of the intent.
#[component]
pub fn OrderFormSubmit(
	#[props(default)] side: OrderSide,
	#[props(default)] disabled: bool,
	#[props(default)] class: String,
	onclick: Option<EventHandler<MouseEvent>>,
	children: Element,
) -> Element {
	let cls = cn!(ORDER_FORM_SUBMIT_BASE, side.as_class(), class);
	rsx! {
		button {
			class: cls,
			"data-slot": "order-form-submit",
			"data-side": side.as_ref(),
			r#type: "submit",
			disabled,
			onclick: move |e| { if let Some(h) = onclick { h.call(e); } },
			{children}
		}
	}
}
/// The open-orders pane with nothing in it.
#[component]
pub fn OpenOrdersEmpty(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(OPEN_ORDERS_EMPTY, class);
	rsx! {
		div { class: cls, "data-slot": "open-orders-empty", {children} }
	}
}
/// The bar is a CSS percentage, so the fraction is clamped and rounded once
/// here; a NaN from an empty book reads as no depth rather than as `NaN%`.
fn depth_percent(depth: f64) -> u8 {
	if depth.is_nan() {
		return 0;
	}
	// Truncation is the point: the value is clamped to 0..=100 first.
	(depth.clamp(0.0, 1.0) * 100.0).round() as u8
}







#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn pane_is_placed_by_its_area() {
		fn app() -> Element {
			rsx! {
				Terminal {
					TerminalPane { area: TerminalArea::Form, "f" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"terminal\""), "{html}");
		assert!(html.contains("lg:col-start-3"), "{html}");
		assert!(html.contains("data-area=\"form\""), "{html}");
	}

	#[test]
	fn ticker_takes_the_full_width_slot() {
		fn app() -> Element {
			rsx! {
				TerminalTicker {
					TickerStat { label: "Last", value: "1.024", class: "text-positive" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("lg:col-span-3"), "{html}");
		assert!(html.contains("Last"), "{html}");
		assert!(html.contains("text-positive"), "the figure takes the caller's valence: {html}");
		assert!(html.contains("tabular-nums"), "{html}");
	}

	#[test]
	fn book_row_colours_the_price_and_sizes_the_depth_bar() {
		fn app() -> Element {
			rsx! {
				OrderBookRow { side: BookSide::Ask, price: "1.030", size: "120", total: "360", depth: 0.42 }
			}
		}
		let html = render(app);
		assert!(html.contains("text-left text-accent-error"), "the price keeps its alignment beside the side colour: {html}");
		assert!(html.contains("bg-accent-error/15"), "{html}");
		assert!(html.contains("width: 42%"), "{html}");
		assert!(html.contains("data-side=\"ask\""), "{html}");
	}

	#[test]
	fn depth_is_clamped_to_a_percentage() {
		assert_eq!(depth_percent(-0.5), 0);
		assert_eq!(depth_percent(0.0), 0);
		assert_eq!(depth_percent(0.5), 50);
		assert_eq!(depth_percent(1.7), 100);
		assert_eq!(depth_percent(f64::NAN), 0);
	}

	#[test]
	fn tape_row_colours_the_bid_side_positive() {
		fn app() -> Element {
			rsx! {
				TradesTapeRow { side: BookSide::Bid, price: "1.020", size: "5", time: "12:00:01" }
			}
		}
		let html = render(app);
		assert!(html.contains("text-positive"), "{html}");
		assert!(html.contains("12:00:01"), "{html}");
	}

	#[test]
	fn submit_fills_by_side() {
		fn buy() -> Element {
			rsx! {
				OrderFormSubmit { "Buy" }
			}
		}
		let html = render(buy);
		assert!(html.contains("bg-positive"), "{html}");
		assert!(html.contains("text-on-positive"), "{html}");
		assert!(html.contains("type=\"submit\""), "{html}");

		fn sell() -> Element {
			rsx! {
				OrderFormSubmit { side: OrderSide::Sell, disabled: true, "Sell" }
			}
		}
		let html = render(sell);
		assert!(html.contains("bg-accent-error"), "{html}");
		assert!(html.contains("disabled"), "{html}");
	}

	#[test]
	fn form_row_and_empty_state_render() {
		fn app() -> Element {
			rsx! {
				OrderForm {
					OrderFormRow { label: "Fee", value: "0.10" }
				}
				OpenOrdersEmpty { "No open orders" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"order-form\""), "{html}");
		assert!(html.contains("Fee"), "{html}");
		assert!(html.contains("No open orders"), "{html}");
		assert!(html.contains("text-ink-soft"), "{html}");
	}
}
