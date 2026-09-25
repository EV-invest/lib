use crate::{Size, focus::option_focus_ring};

/// One option of the open list. The focused row carries
/// [`OPTION_FOCUS_RING`](crate::OPTION_FOCUS_RING) over its tint.
pub const SELECT_ITEM: &str = concat!(
	"focus:bg-hover focus:text-ink ",
	option_focus_ring!(),
	" [&_svg:not([class*='text-'])]:text-ink-soft relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 \
	 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none \
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
