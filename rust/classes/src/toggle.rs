use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::Size;

pub const TOGGLE_BASE: &str = "inline-flex items-center justify-center gap-2 rounded-[var(--control-radius)] text-sm font-medium \
                               hover:bg-muted hover:text-ink-soft disabled:pointer-events-none disabled:opacity-50 \
                               data-[state=on]:bg-hover data-[state=on]:text-ink [&_svg]:pointer-events-none \
                               [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring \
                               focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] \
                               aria-invalid:ring-accent-error/20 aria-invalid:border-accent-error whitespace-nowrap";

#[derive(PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum ToggleVariant {
	#[tw(default, class = "bg-transparent")]
	Default,
	#[tw(class = "border border-input bg-transparent shadow-xs hover:bg-hover hover:text-ink")]
	Outline,
}

/// Per-size height + min-width + horizontal padding. Mirrors the TS `toggleSizeClasses` table.
pub fn toggle_size_class(size: Size) -> &'static str {
	match size {
		Size::Xs => "h-7 px-1 min-w-7",
		Size::Sm => "h-8 px-1.5 min-w-8",
		Size::Md => "h-9 px-2 min-w-9",
		Size::Lg => "h-10 px-2.5 min-w-10",
		Size::Xl => "h-12 px-3 min-w-12",
	}
}
