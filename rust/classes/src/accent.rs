use crate::{ButtonVariant, focus::filled_focus_ring};

/// Which rung of the accent ladder a surface wears — quiet to loud. See
/// docs/spec/accents.md; a rung is picked by how loud the thing should be, never
/// by what it means.
///
/// No `Default`: a button without an accent is the normal case, so the axis is
/// `Option<Accent>` rather than a defaulted enum.
///
/// The tables below spell out every rung because Tailwind scans for literal
/// class names; `bg-accent-{rung}` would compile to nothing.
#[derive(Clone, Copy, Debug, PartialEq, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum Accent {
	Trace,
	Debug,
	Info,
	Warn,
	Error,
}

/// Accent text colour — on a status page it threads through the mark, the
/// eyebrow, the code and the headline.
pub fn accent_text_class(accent: Accent) -> &'static str {
	match accent {
		Accent::Trace => "text-accent-trace",
		Accent::Debug => "text-accent-debug",
		Accent::Info => "text-accent-info",
		Accent::Warn => "text-accent-warn",
		Accent::Error => "text-accent-error",
	}
}

/// Repaints a filled control at the rung. A ghost or link button wearing it
/// becomes a fill too, so the face brings [`FILLED_FOCUS_RING`](crate::FILLED_FOCUS_RING)
/// with it rather than leaving that to the variant.
pub fn accent_fill_class(accent: Accent) -> &'static str {
	match accent {
		Accent::Trace => concat!("bg-accent-trace text-on-accent-trace hover:bg-accent-trace/90 ", filled_focus_ring!()),
		Accent::Debug => concat!("bg-accent-debug text-on-accent-debug hover:bg-accent-debug/90 ", filled_focus_ring!()),
		Accent::Info => concat!("bg-accent-info text-on-accent-info hover:bg-accent-info/90 ", filled_focus_ring!()),
		Accent::Warn => concat!("bg-accent-warn text-on-accent-warn hover:bg-accent-warn/90 ", filled_focus_ring!()),
		Accent::Error => concat!("bg-accent-error text-on-accent-error hover:bg-accent-error/90 ", filled_focus_ring!()),
	}
}

/// Tints an outlined control's border and ink at the rung, leaving it outlined.
pub fn accent_outline_class(accent: Accent) -> &'static str {
	match accent {
		Accent::Trace => "border border-accent-trace/40 text-accent-trace hover:bg-accent-trace/10",
		Accent::Debug => "border border-accent-debug/40 text-accent-debug hover:bg-accent-debug/10",
		Accent::Info => "border border-accent-info/40 text-accent-info hover:bg-accent-info/10",
		Accent::Warn => "border border-accent-warn/40 text-accent-warn hover:bg-accent-warn/10",
		Accent::Error => "border border-accent-error/40 text-accent-error hover:bg-accent-error/10",
	}
}

/// Which face a button's accent wears. The choice is the *variant's* — an
/// outlined button tints what it already has, anything else repaints — so a
/// caller never names a face; it names a rung and a variant, and both ports
/// resolve the pair here.
pub fn button_accent_class(accent: Accent, variant: &ButtonVariant) -> &'static str {
	match variant {
		ButtonVariant::Outline => accent_outline_class(accent),
		_ => accent_fill_class(accent),
	}
}
