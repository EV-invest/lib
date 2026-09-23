use crate::Size;

pub const TEXTAREA_BASE: &str = "border-input placeholder:text-ink-soft focus-visible:border-ring \
                             focus-visible:ring-ring/50 aria-invalid:ring-accent-error/20 \
                             aria-invalid:border-accent-error flex field-sizing-content min-h-16 w-full rounded-[var(--control-radius)] \
                             border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] \
                             outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 \
                             md:text-sm";

/// Minimum height, and for `Lg` the inset and type, fused over
/// [`TEXTAREA_BASE`]. The same three steps and the same 16px floor at `Lg` as
/// [`input_size_class`](crate::input_size_class).
pub fn textarea_size_class(size: Size) -> &'static str {
	match size {
		Size::Xs | Size::Sm => "min-h-14",
		Size::Md => "min-h-16",
		Size::Lg | Size::Xl => "min-h-20 px-4 py-3 text-base md:text-base",
	}
}
