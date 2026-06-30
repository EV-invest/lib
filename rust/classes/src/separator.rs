use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const SEPARATOR_BASE: &str = "bg-border shrink-0";

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum Orientation {
	#[tw(default, class = "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full")]
	Horizontal,
	#[tw(class = "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px")]
	Vertical,
}
