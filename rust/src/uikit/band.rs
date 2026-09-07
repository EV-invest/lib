//! Full-bleed page bands and the type vocabulary that goes in them.
//!
//! A page built from these writes no spacing or type-scale class of its own: the
//! rhythm is `--band-py`, the gutter `--page-px` and the headline scale
//! `--display-scale`, so a global retune is one edit in the consumer's tokens.

use dioxus::prelude::*;
use tailwind_fuse::AsTailwindClass;

use crate::{
	cn,
	uikit::{CHECK, DISPLAY_BASE, EYEBROW, LEDE, PROSE, Polarity, SECTION_BASE, SECTION_HEAD, SECTION_PY, SECTION_PY_TIGHT, STAT, STAT_FIGURE, STAT_LABEL, Surface},
};

/// A full-bleed horizontal band. `polarity` sets the token scope on the element,
/// so everything inside reads `text-ink` / `border-border` / `text-ink-soft` and
/// resolves correctly on either side. `id` is set when the band is a scroll
/// anchor; `tight` is the shorter vertical rhythm.
#[component]
pub fn Section(
	#[props(default)] polarity: Polarity,
	#[props(default)] surface: Surface,
	#[props(default)] id: Option<String>,
	#[props(default = false)] tight: bool,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	// The four are conflict-free by construction — a gutter, a scope class, a
	// plane and a rhythm — so only the caller override is worth a merge.
	let base = format!(
		"{SECTION_BASE} {} {} {}",
		polarity.as_class(),
		surface.as_class(),
		if tight { SECTION_PY_TIGHT } else { SECTION_PY }
	);
	let cls = cn!(base, class);
	rsx! {
		section { id, class: cls, "data-slot": "section", {children} }
	}
}

/// The label above a headline, in the interactive role's colour.
#[component]
pub fn Eyebrow(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(EYEBROW, class);
	rsx! {
		p { class: cls, "data-slot": "eyebrow", {children} }
	}
}

/// The headline. One scale for every band on the site, so a retune is one number.
#[component]
pub fn Display(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(DISPLAY_BASE, class);
	rsx! {
		h2 { class: cls, "data-slot": "display", {children} }
	}
}

/// Eyebrow → headline → lede, the head a band shares.
#[component]
pub fn SectionHead(eyebrow: String, title: String, #[props(default)] lede: Option<String>, #[props(default)] class: String) -> Element {
	let cls = cn!(SECTION_HEAD, class);
	rsx! {
		div { class: cls, "data-slot": "section-head",
			Eyebrow { {eyebrow} }
			Display { {title} }
			if let Some(lede) = lede {
				p { class: LEDE, {lede} }
			}
		}
	}
}

/// Body copy at the reading measure.
#[component]
pub fn Prose(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(PROSE, class);
	rsx! {
		p { class: cls, "data-slot": "prose", {children} }
	}
}

/// A figure with its label beside it.
#[component]
pub fn Stat(figure: String, label: String, #[props(default)] class: String) -> Element {
	let cls = cn!(STAT, class);
	rsx! {
		span { class: cls, "data-slot": "stat",
			span { class: STAT_FIGURE, {figure} }
			span { class: STAT_LABEL, {label} }
		}
	}
}

/// The affirmative tick. Positive is a valence, not a significance rung — see
/// the kit's `docs/spec/accents.md`.
#[component]
pub fn Check(#[props(default)] class: String) -> Element {
	let cls = cn!(CHECK, class);
	rsx! {
		span { class: cls, "data-slot": "check", "aria-hidden": "true", "✓" }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn section_sets_the_scope_class_and_its_plane() {
		fn app() -> Element {
			rsx! {
				Section { polarity: Polarity::Dark, surface: Surface::Card, id: "quote", "body" }
			}
		}
		let html = render(app);
		assert!(html.contains("dark"), "{html}");
		assert!(html.contains("bg-card"), "{html}");
		assert!(html.contains("text-ink"), "the plane pairs its own ink: {html}");
		assert!(html.contains("id=\"quote\""), "{html}");
		assert!(html.contains("py-[var(--band-py)]"), "{html}");
	}

	#[test]
	fn tight_takes_the_short_rhythm() {
		fn app() -> Element {
			rsx! {
				Section { tight: true, "body" }
			}
		}
		let html = render(app);
		assert!(html.contains("py-[var(--band-py-tight)]"), "{html}");
	}

	#[test]
	fn section_head_renders_the_lede_only_when_given() {
		fn with() -> Element {
			rsx! {
				SectionHead { eyebrow: "PRICES", title: "Fixed, agreed first", lede: "No surprises." }
			}
		}
		let html = render(with);
		assert!(html.contains("PRICES"), "{html}");
		assert!(html.contains("Fixed, agreed first"), "{html}");
		assert!(html.contains("No surprises."), "{html}");

		fn without() -> Element {
			rsx! {
				SectionHead { eyebrow: "PRICES", title: "Fixed, agreed first" }
			}
		}
		let html = render(without);
		assert!(!html.contains("text-ink-soft"), "no lede paragraph without the copy: {html}");
	}
}
