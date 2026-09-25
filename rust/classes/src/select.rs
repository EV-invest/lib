use crate::{Size, focus::option_focus_ring};

/// How big the open list may get. At least the trigger's width (the TS port
/// writes it to `--select-trigger-width`; the Rust one has no measure and keeps
/// the 8rem floor), at most 24rem and never wider or taller than the viewport
/// less a 1rem gutter a side — so the list the floating placement clamps
/// always fits between the edges, and a long option wraps (see
/// [`SELECT_ITEM`]) instead of widening the list off-screen. The trigger's width
/// wins over the 24rem cap — `min-width` beats `max-width` in CSS — so a trigger
/// wider than 24rem opens a list exactly as wide as itself.
pub const SELECT_CONTENT_BOUNDS: &str = "min-w-[max(8rem,var(--select-trigger-width,0px))] max-w-[min(24rem,calc(100vw-2rem))] \
	 max-h-[min(24rem,calc(100dvh-2rem))]";

/// One option of the open list. The focused row carries
/// [`OPTION_FOCUS_RING`](crate::OPTION_FOCUS_RING) over its tint.
///
/// `overflow-wrap: anywhere` rather than `break-words`: the label sits in a
/// flex item, whose minimum width is its min-content, and only `anywhere`
/// shrinks that — with `break-word` an unbroken word still props the row open.
pub const SELECT_ITEM: &str = concat!(
	"focus:bg-hover focus:text-ink ",
	option_focus_ring!(),
	" [&_svg:not([class*='text-'])]:text-ink-soft relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 \
	 text-sm whitespace-normal [overflow-wrap:anywhere] outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none \
	 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"
);

/// The `SelectTrigger`'s height, and for `Lg` its inset and type, on the same
/// three steps as [`input_size_class`](crate::input_size_class), so a trigger
/// lines up with the input beside it in a form row.
pub fn select_trigger_size_class(size: Size) -> &'static str {
	match size {
		Size::Xs | Size::Sm => "h-8",
		Size::Md => "h-9",
		Size::Lg | Size::Xl => "h-12 px-4 text-base",
	}
}

/// The `NativeSelect`'s height, and for `Lg` its inset and type. The inset is
/// written per side because the right one clears the arrow: a `px-*` here would
/// fuse that clearance away.
pub fn native_select_size_class(size: Size) -> &'static str {
	match size {
		Size::Xs | Size::Sm => "h-8",
		Size::Md => "h-9",
		Size::Lg | Size::Xl => "h-12 pr-11 pl-4 text-base md:text-base",
	}
}
