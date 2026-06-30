use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::Size;

pub const TOGGLE_BASE: &str = "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium \
                               hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 \
                               data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none \
                               [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring \
                               focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] \
                               aria-invalid:ring-destructive/20 aria-invalid:border-destructive whitespace-nowrap";

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum ToggleVariant {
	#[tw(default, class = "bg-transparent")]
	Default,
	#[tw(class = "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground")]
	Outline,
}

/// Per-size height + min-width + horizontal padding. Mirrors the TS `toggleSizeClasses` table.
pub fn toggle_size_class(size: Size) -> &'static str {
	match size {
		Size::Sm => "h-8 px-1.5 min-w-8",
		Size::Md => "h-9 px-2 min-w-9",
		Size::Lg => "h-10 px-2.5 min-w-10",
	}
}
