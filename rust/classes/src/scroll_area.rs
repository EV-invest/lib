use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const SCROLL_AREA_VIEWPORT: &str =
	"focus-visible:ring-ring/50 size-full rounded-[inherit] overflow-auto transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1";

pub const SCROLL_AREA_THUMB: &str = "bg-border relative flex-1 rounded-full";

pub const SCROLLBAR_BASE: &str = "flex touch-none p-px transition-colors select-none";

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum ScrollBarOrientation {
	#[tw(default, class = "h-full w-2.5 border-l border-l-transparent")]
	Vertical,
	#[tw(class = "h-2.5 flex-col border-t border-t-transparent")]
	Horizontal,
}
