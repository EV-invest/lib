use crate::Size;

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
