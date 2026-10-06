use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const TABLE_CONTAINER: &str = "relative w-full overflow-x-auto";

/// The table itself. Its variant and density classes set nothing but inherited
/// custom properties (`--table-*`), which [`TABLE_HEAD`] and [`TABLE_CELL`]
/// read. That keeps the TS `Table` a server component — no context carries the
/// variant down — and keeps every cell utility a plain single-class rule, so a
/// cell's own `px-4` or `text-ink` fuses over the kit's and wins. A descendant
/// selector on the table (`[&_td]:px-5`) would outrank it instead.
pub const TABLE: &str = "w-full caption-bottom text-sm";

/// The card a `variant="card"` table sits in: the [`CARD`](crate::CARD)
/// surface without its padding and gap, clipping the rows to the radius.
pub const TABLE_CARD: &str = "bg-card text-ink overflow-hidden rounded-xl border border-border shadow-sm";
pub const TABLE_HEADER: &str = "[&_tr]:border-b";
pub const TABLE_BODY: &str = "[&_tr:last-child]:border-0";
pub const TABLE_FOOTER: &str = "bg-muted/50 border-t border-border font-medium [&>tr]:last:border-b-0";
pub const TABLE_ROW: &str = "hover:bg-muted/50 data-[state=selected]:bg-muted border-b border-border transition-colors";
pub const TABLE_HEAD: &str = "text-[color:var(--table-head-ink,var(--ink))] h-[var(--table-head-h,calc(var(--spacing)*10))] \
                             px-[var(--table-px,calc(var(--spacing)*2))] text-start align-middle font-medium whitespace-nowrap \
                             text-[length:var(--table-head-text)] tracking-[var(--table-head-tracking)] [text-transform:var(--table-head-case)] \
                             [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]";
pub const TABLE_CELL: &str = "px-[var(--table-px,calc(var(--spacing)*2))] py-[var(--table-dense-py,var(--table-py,calc(var(--spacing)*2)))] \
                             align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]";
pub const TABLE_CAPTION: &str = "text-ink-soft mt-4 text-sm";
/// The look of the table: `default` is the shadcn canon, `card` the tracked
/// uppercase list that sits edge to edge in a [`TABLE_CARD`].
#[derive(Debug, PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum TableVariant {
	// The cells' `var()` fallbacks are the default look, so a bare `TableCell`
	// outside any `Table` still renders it. The properties inherit, so a default
	// table nested in a `card` one resets them to `initial` (= unset, the
	// fallbacks apply) instead of wearing its parent's geometry.
	#[tw(
		default,
		class = "[--table-px:initial] [--table-py:initial] [--table-head-ink:initial] [--table-head-text:initial] \
		                   [--table-head-tracking:initial] [--table-head-case:initial]"
	)]
	Default,
	// Padding big enough that a figure does not read as clipped against the
	// card edge. The head row loses its hover: it is not a row you act on —
	// its own head only (`>`), not a nested table's.
	#[tw(class = "[--table-px:calc(var(--spacing)*5)] [--table-py:calc(var(--spacing)*3)] [--table-head-ink:var(--ink-soft)] \
		         [--table-head-text:var(--text-xs)] [--table-head-tracking:var(--tracking-wide)] [--table-head-case:uppercase] \
		         [&>thead>tr:hover]:bg-transparent")]
	Card,
}

/// Row height. Kept to its own custom properties (`--table-dense-*`) rather
/// than overwriting the variant's `--table-py`, so `card` × `compact` composes
/// without depending on the merge resolving two writes of one property.
#[derive(Debug, PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum TableDensity {
	#[tw(default, class = "[--table-dense-py:initial] [--table-head-h:initial]")]
	Default,
	#[tw(class = "[--table-dense-py:calc(var(--spacing)*1.5)] [--table-head-h:calc(var(--spacing)*8)]")]
	Compact,
}

/// Inline alignment of one head or cell. `end` is for figures, so it brings
/// tabular numerals: a column of amounts lines up digit for digit.
#[derive(Debug, PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum TableAlign {
	#[tw(default, class = "text-start")]
	Start,
	#[tw(class = "text-end tabular-nums")]
	End,
}

// The typography properties have no fallback on purpose: an undefined custom
// property makes the declaration compute to `unset`, and font-size,
// letter-spacing and text-transform all inherit — so outside a `card` table the
// head keeps the table's own `text-sm` exactly as before. Colours read the
// `:root` tokens (`--ink`), not `--color-ink`: the theme is `@theme inline`, so
// Tailwind never emits the `--color-*` names for a `var()` to find.

#[cfg(test)]
mod tests {
	use super::*;
	use crate::cn;

	fn table(variant: TableVariant, density: TableDensity) -> String {
		cn!(TABLE, variant.as_class(), density.as_class())
	}

	/// The whole point of the custom properties: the variant never writes a
	/// cell property, so a cell's own utility is the only one left after fusing.
	#[test]
	fn cell_override_beats_table_geometry() {
		let cell = cn!(TABLE_CELL, "px-4");
		assert!(cell.contains("px-4"), "{cell}");
		assert!(!cell.contains("px-[var(--table-px"), "{cell}");
		assert!(cell.contains("py-[var(--table-dense-py"), "{cell}");

		let cell = cn!(TABLE_CELL, "p-0");
		assert!(!cell.contains("px-[") && !cell.contains("py-["), "{cell}");
	}

	#[test]
	fn head_override_beats_inherited_typography() {
		let head = cn!(TABLE_HEAD, "text-accent-error h-12");
		assert!(!head.contains("text-[color:"), "{head}");
		assert!(head.contains("text-[length:var(--table-head-text)]"), "font size is a separate group: {head}");
		assert!(!head.contains("h-[var("), "{head}");
	}

	/// Card and compact write disjoint properties, so fusing keeps all of them
	/// whichever the merge thinks of two arbitrary properties.
	#[test]
	fn card_and_compact_compose() {
		let both = table(TableVariant::Card, TableDensity::Compact);
		for prop in ["--table-px:", "--table-py:", "--table-head-case:uppercase", "--table-dense-py:", "--table-head-h:"] {
			assert!(both.contains(prop), "{prop} missing from {both}");
		}
		assert!(both.contains("[&>thead>tr:hover]:bg-transparent"), "{both}");
	}

	/// A default table nested in a card one must not inherit the card geometry:
	/// it resets every property the variants and densities write.
	#[test]
	fn default_table_resets_inherited_geometry() {
		let plain = table(TableVariant::Default, TableDensity::Default);
		for prop in [
			"--table-px:",
			"--table-py:",
			"--table-head-ink:",
			"--table-head-text:",
			"--table-head-tracking:",
			"--table-head-case:",
			"--table-dense-py:",
			"--table-head-h:",
		] {
			assert!(plain.contains(&format!("[{prop}initial]")), "{prop} not reset in {plain}");
		}
	}

	#[test]
	fn align_end_is_tabular_and_overrides_the_head_start() {
		let head = cn!(TABLE_HEAD, TableAlign::End.as_class());
		assert!(head.contains("text-end") && head.contains("tabular-nums"), "{head}");
		assert!(!head.contains("text-start"), "{head}");
	}
}
