use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const ITEM_GROUP: &str = "group/item-group flex flex-col";

pub const ITEM_SEPARATOR: &str = "my-0";

/// Shared base for the two-axis (variant × size) item. Fused with the variant
/// and size class last-wins, mirroring the TS `cn(ITEM_BASE, itemVariants[v], itemSizes[s])`.
pub const ITEM_BASE: &str = "group/item flex items-center border border-transparent text-sm rounded-md transition-colors \
                             [a]:hover:bg-accent/50 [a]:transition-colors duration-100 flex-wrap outline-none \
                             focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

pub const ITEM_MEDIA_BASE: &str = "flex shrink-0 items-center justify-center gap-2 \
                                   group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none \
                                   group-has-[[data-slot=item-description]]/item:translate-y-0.5";

pub const ITEM_CONTENT: &str = "flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none";

pub const ITEM_TITLE: &str = "flex w-fit items-center gap-2 text-sm leading-snug font-medium";

pub const ITEM_DESCRIPTION: &str = "text-muted-foreground line-clamp-2 text-sm leading-normal font-normal text-balance \
                                    [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4";

pub const ITEM_ACTIONS: &str = "flex items-center gap-2";

pub const ITEM_HEADER: &str = "flex basis-full items-center justify-between gap-2";

pub const ITEM_FOOTER: &str = "flex basis-full items-center justify-between gap-2";

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum ItemVariant {
	#[tw(default, class = "bg-transparent")]
	Default,
	#[tw(class = "border-border")]
	Outline,
	#[tw(class = "bg-muted/50")]
	Muted,
}

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum ItemSize {
	#[tw(default, class = "p-4 gap-4")]
	Md,
	#[tw(class = "py-3 px-4 gap-2.5")]
	Sm,
}

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum ItemMediaVariant {
	#[tw(default, class = "bg-transparent")]
	Default,
	#[tw(class = "size-8 border rounded-sm bg-muted [&_svg:not([class*='size-'])]:size-4")]
	Icon,
	#[tw(class = "size-10 rounded-sm overflow-hidden [&_img]:size-full [&_img]:object-cover")]
	Image,
}
