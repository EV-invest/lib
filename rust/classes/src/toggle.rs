use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::{Size, focus::filled_focus_ring};

/// On, the toggle paints the `primary` fill (lib#175): the `bg-hover` tint it
/// wore before measured ~1.2:1 against the surface and was the very colour an
/// outline toggle wore on hover, so a selected item could not be told from a
/// pointed-at one. A fill, it wears the offset ring rather than the halo — see
/// [`FILLED_FOCUS_RING`](crate::FILLED_FOCUS_RING).
pub const TOGGLE_BASE: &str = concat!(
	"inline-flex items-center justify-center gap-2 rounded-[var(--control-radius)] text-sm font-medium \
	 hover:bg-muted hover:text-ink-soft disabled:pointer-events-none disabled:opacity-50 \
	 data-[state=on]:bg-primary data-[state=on]:text-on-primary [&_svg]:pointer-events-none \
	 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring outline-none \
	 transition-[color,box-shadow] aria-invalid:ring-accent-error/20 aria-invalid:border-accent-error \
	 whitespace-nowrap ",
	filled_focus_ring!()
);

#[derive(PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum ToggleVariant {
	#[tw(default, class = "bg-transparent")]
	Bare,
	#[tw(class = "border border-input bg-transparent shadow-xs hover:bg-hover hover:text-ink data-[state=on]:border-primary")]
	Outline,
}

/// Per-size height + min-width + horizontal padding. Mirrors the TS `toggleSizeClasses` table.
pub fn toggle_size_class(size: Size) -> &'static str {
	match size {
		Size::Xs => "h-7 px-1 min-w-7",
		Size::Sm => "h-8 px-1.5 min-w-8",
		Size::Md => "h-9 px-2 min-w-9",
		Size::Lg => "h-10 px-2.5 min-w-10",
		// `Xl` already clears the 44 px floor, and a step with no TS key would
		// ship classes missing from the inventory
		Size::Touch | Size::Xl => "h-12 px-3 min-w-12",
	}
}
