use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::Size;

/// Base classes shared by every button variant. Split out from the variant enum
/// so the TS codegen can emit it verbatim and `button_classes` fuses it last-wins.
pub const BUTTON_BASE: &str = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--control-radius)] text-sm \
                               font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 \
                               [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 \
                               outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] \
                               aria-invalid:ring-accent-error/20 aria-invalid:border-accent-error";

/// Per-variant classes only; the base rides on [`BUTTON_BASE`]. `as_class()` yields
/// the variant string, the codegen key is `as_ref()` (kebab).
#[derive(Debug, PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum ButtonVariant {
	#[tw(default, class = "bg-primary text-on-primary hover:bg-primary/90")]
	Primary,
	#[tw(class = "bg-secondary text-on-secondary hover:bg-secondary/80")]
	Secondary,
	#[tw(class = "border bg-transparent shadow-xs hover:bg-hover hover:text-ink")]
	Outline,
	#[tw(class = "hover:bg-hover hover:text-ink")]
	Ghost,
	#[tw(class = "bg-accent-error text-on-accent-error hover:bg-accent-error/90 focus-visible:ring-accent-error/20")]
	Destructive,
	#[tw(class = "text-primary underline-offset-4 hover:underline")]
	Link,
}

/// Size + shape dimensions. An `icon` button is a square (`h-N aspect-square px-0`);
/// otherwise per-size height + text padding. Mirrors the TS `buttonSizeClasses` table.
pub fn button_size_class(size: Size, icon: bool) -> &'static str {
	match (size, icon) {
		(Size::Xs, false) => "h-7 gap-1 px-2 text-xs has-[>svg]:px-1.5",
		(Size::Sm, false) => "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
		(Size::Md, false) => "h-9 px-4 py-[var(--control-py)] has-[>svg]:px-3",
		(Size::Lg, false) => "h-10 px-6 has-[>svg]:px-4",
		// the CTA size: geometry entirely from the control tokens, so a consumer
		// reshapes its call to action by writing values
		(Size::Xl, false) => "px-[var(--control-px)] py-[var(--control-py)] text-[length:var(--control-text)]",
		(Size::Xs, true) => "h-7 aspect-square px-0",
		(Size::Sm, true) => "h-8 aspect-square px-0",
		(Size::Md, true) => "h-9 aspect-square px-0",
		(Size::Lg, true) => "h-10 aspect-square px-0",
		(Size::Xl, true) => "aspect-square p-[var(--control-py)]",
	}
}
