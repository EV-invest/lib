#[derive(strum::AsRefStr, Clone, Copy, Default, strum::EnumIter, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum Size {
	Sm,
	#[default]
	Md,
	Lg,
}

impl Size {
	/// Tailwind magnitude; the component picks the axis (h-/size-/min-w-).
	pub fn scale(&self) -> u8 {
		match self {
			Size::Sm => 8,
			Size::Md => 9,
			Size::Lg => 10,
		}
	}
}
