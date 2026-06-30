use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const BUTTON_GROUP_BASE: &str = "flex w-fit items-stretch [&>*]:focus-visible:z-10 [&>*]:focus-visible:relative \
                                     [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 \
                                     has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md \
                                     has-[>[data-slot=button-group]]:gap-2";

pub const BUTTON_GROUP_TEXT_BASE: &str = "bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium \
                                          shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4";

pub const BUTTON_GROUP_SEPARATOR_BASE: &str = "bg-input relative !m-0 self-stretch shrink-0 data-[orientation=vertical]:h-auto";

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum ButtonGroupOrientation {
	#[tw(default, class = "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none")]
	Horizontal,
	#[tw(class = "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none")]
	Vertical,
}
