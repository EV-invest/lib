use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::Size;

/// Base classes shared by every button variant. Split out from the variant enum
/// so the TS codegen can emit it verbatim and `button_classes` fuses it last-wins.
pub const BUTTON_BASE: &str = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm \
                               font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 \
                               [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 \
                               outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] \
                               aria-invalid:ring-destructive/20 aria-invalid:border-destructive";

/// Per-variant classes only; the base rides on [`BUTTON_BASE`]. `as_class()` yields
/// the variant string, the codegen key is `as_ref()` (kebab).
#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum ButtonVariant {
	#[tw(default, class = "bg-primary text-primary-foreground hover:bg-primary/90")]
	Default,
	#[tw(class = "bg-secondary text-secondary-foreground hover:bg-secondary/80")]
	Secondary,
	#[tw(class = "border bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground")]
	Outline,
	#[tw(class = "hover:bg-accent hover:text-accent-foreground")]
	Ghost,
	#[tw(class = "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20")]
	Destructive,
	#[tw(class = "text-primary underline-offset-4 hover:underline")]
	Link,
}

/// Size + shape dimensions. An `icon` button is a square (`h-N aspect-square px-0`);
/// otherwise per-size height + text padding. Mirrors the TS `buttonSizeClasses` table.
pub fn button_size_class(size: Size, icon: bool) -> &'static str {
	match (size, icon) {
		(Size::Sm, false) => "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
		(Size::Md, false) => "h-9 px-4 py-2 has-[>svg]:px-3",
		(Size::Lg, false) => "h-10 rounded-md px-6 has-[>svg]:px-4",
		(Size::Sm, true) => "h-8 aspect-square px-0",
		(Size::Md, true) => "h-9 aspect-square px-0",
		(Size::Lg, true) => "h-10 aspect-square px-0",
	}
}
