/// The kit's one control scale. Every sized component reads it, so a component
/// that needs a step nobody else has adds it here rather than growing an enum of
/// its own.
#[derive(Clone, Copy, Default, PartialEq, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum Size {
	Xs,
	Sm,
	#[default]
	Md,
	Lg,
	Xl,
}

impl Size {
	/// Tailwind magnitude; the component picks the axis (h-/size-/min-w-).
	pub fn scale(&self) -> u8 {
		match self {
			Size::Xs => 7,
			Size::Sm => 8,
			Size::Md => 9,
			Size::Lg => 10,
			Size::Xl => 12,
		}
	}
}
