use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const EMPTY: &str = "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12";

pub const EMPTY_HEADER: &str = "flex max-w-sm flex-col items-center gap-2 text-center";

pub const EMPTY_TITLE: &str = "text-lg font-medium tracking-tight";

pub const EMPTY_DESCRIPTION: &str = "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4";

pub const EMPTY_CONTENT: &str = "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance";

pub const EMPTY_MEDIA_BASE: &str = "flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0";

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum EmptyMediaVariant {
	#[tw(default, class = "bg-transparent")]
	Default,
	#[tw(class = "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6")]
	Icon,
}
