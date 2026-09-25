/// Spelled as a macro so the fill tables can `concat!` it into their literals —
/// Tailwind scans for whole class names, so the classes have to sit in the
/// string a table hands out, not be fused in at render time. `TwVariant`
/// attributes take only a literal, so the variant enums repeat it verbatim and
/// the tests below hold them to it.
macro_rules! filled_focus_ring {
	() => {
		"focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	};
}
pub(crate) use filled_focus_ring;

/// The focus indicator for a control that paints a fill (lib#129). The kit's
/// default — a 3px halo of the ring at 50 % — composites to ~2:1 against the
/// surface and all but vanishes into a teal fill. This one is the solid ring
/// standing 2px off the control, so the surface shows between the two: the ring
/// is only ever measured against the surface and the fill against the surface,
/// both of which the TS token tests hold at 3:1 on every palette.
///
/// `outline-solid` is spelled out because `outline-none` on the base class
/// leaves the outline style at `none`, and a width alone would paint nothing.
///
/// Every table that paints a fill already carries it: the filled button and
/// badge variants, [`accent_fill_class`](crate::accent_fill_class), the switch
/// and the checkbox. It is exported for a consumer's own filled control.
pub const FILLED_FOCUS_RING: &str = filled_focus_ring!();

/// A macro for the same reason as [`filled_focus_ring!`]: the item tables
/// `concat!` it into their literals.
macro_rules! option_focus_ring {
	() => {
		"focus-visible:inset-ring-2 focus-visible:inset-ring-ring"
	};
}
pub(crate) use option_focus_ring;

/// The keyboard focus of a row the arrows move through — a `SelectItem`, a menu
/// item. Such a row takes DOM focus but draws no outline, and the `bg-hover`
/// tint it had alone is a surface step, not an indicator: 1.00–1.27:1 against
/// the popover it sits on, down to exactly 1:1 where a palette pins `--hover`
/// to its popover. The ring is `--ring`, which the token tests hold at 3:1
/// against the popover and against the tint inside it on every palette.
///
/// Inset, because the rows fill the list edge to edge and an outset ring would
/// be clipped by the list's `overflow`. `focus-visible`, so a pointer — which
/// never moves the focus off the landed row — sees only the tint.
pub const OPTION_FOCUS_RING: &str = option_focus_ring!();

#[cfg(test)]
mod tests {
	use strum::IntoEnumIterator;
	use tailwind_fuse::AsTailwindClass;

	use super::{FILLED_FOCUS_RING, OPTION_FOCUS_RING};
	use crate::{Accent, BadgeVariant, ButtonVariant, CHECKBOX_BASE, SELECT_ITEM, SWITCH_BASE, accent_fill_class, accent_outline_class};

	#[test]
	fn filled_button_variants_carry_the_ring() {
		for variant in ButtonVariant::iter() {
			let filled = matches!(variant, ButtonVariant::Primary | ButtonVariant::Secondary | ButtonVariant::Destructive);
			assert_eq!(variant.as_class().contains(FILLED_FOCUS_RING), filled, "{variant:?}");
		}
	}

	#[test]
	fn filled_badge_variants_carry_the_ring() {
		for variant in BadgeVariant::iter() {
			let filled = matches!(variant, BadgeVariant::Primary | BadgeVariant::Secondary | BadgeVariant::Destructive);
			assert_eq!(variant.as_class().contains(FILLED_FOCUS_RING), filled, "{}", variant.as_ref());
		}
	}

	/// An accent repaints a fill, so its fill face brings the ring; the outline
	/// face only tints a control that sits on the surface, so it keeps the halo.
	#[test]
	fn accent_fill_carries_the_ring_and_outline_does_not() {
		for accent in Accent::iter() {
			assert!(accent_fill_class(accent).ends_with(FILLED_FOCUS_RING), "{accent:?}");
			assert!(!accent_outline_class(accent).contains(FILLED_FOCUS_RING), "{accent:?}");
		}
	}

	#[test]
	fn list_rows_carry_the_option_ring() {
		assert!(SELECT_ITEM.contains(OPTION_FOCUS_RING), "{SELECT_ITEM}");
	}

	#[test]
	fn switch_and_checkbox_carry_the_ring_without_the_halo() {
		for base in [SWITCH_BASE, CHECKBOX_BASE] {
			assert!(base.ends_with(FILLED_FOCUS_RING), "{base}");
			assert!(!base.contains("ring-[3px]"), "{base}");
		}
	}
}
