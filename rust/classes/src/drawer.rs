use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const DRAWER_CONTENT_BASE: &str = "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex h-auto border \
                                      transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500";

pub const DRAWER_OVERLAY: &str = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                                 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50";

pub const DRAWER_HANDLE: &str = "bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full";

pub const DRAWER_HEADER: &str = "flex flex-col gap-0.5 p-4 text-center sm:gap-1.5 sm:text-left";

pub const DRAWER_FOOTER: &str = "mt-auto flex flex-col gap-2 p-4";

pub const DRAWER_TITLE: &str = "text-foreground font-semibold";

pub const DRAWER_DESCRIPTION: &str = "text-muted-foreground text-sm";

/// Edge the drawer slides in from. The shared content base rides on [`DRAWER_CONTENT_BASE`].
#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum DrawerDirection {
	#[tw(
		default,
		class = "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom inset-x-0 bottom-0 mt-24 max-h-[80vh] flex-col rounded-t-lg border-b-0"
	)]
	Bottom,
	#[tw(class = "data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top inset-x-0 top-0 mb-24 max-h-[80vh] flex-col rounded-b-lg border-t-0")]
	Top,
	#[tw(class = "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left inset-y-0 left-0 w-3/4 flex-row border-r sm:max-w-sm")]
	Left,
	#[tw(class = "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right inset-y-0 right-0 w-3/4 flex-row border-l sm:max-w-sm")]
	Right,
}
