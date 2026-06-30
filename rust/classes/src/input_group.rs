use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const INPUT_GROUP_BASE: &str = "group/input-group border-input relative flex w-full items-center rounded-md border \
                                    shadow-xs transition-[color,box-shadow] outline-none \
                                    h-9 min-w-0 has-[>textarea]:h-auto \
                                    has-[>[data-align=inline-start]]:[&>input]:pl-2 \
                                    has-[>[data-align=inline-end]]:[&>input]:pr-2 \
                                    has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3 \
                                    has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 \
                                    has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] \
                                    has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive";

pub const INPUT_GROUP_ADDON_BASE: &str = "text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 \
                                          py-1.5 text-sm font-medium select-none [&>svg:not([class*='size-'])]:size-4 \
                                          [&>kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50";

pub const INPUT_GROUP_BUTTON_BASE: &str = "text-sm shadow-none flex gap-2 items-center";

pub const INPUT_GROUP_TEXT: &str = "text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4";

/// Appended to the shared `INPUT_BASE` for a group-embedded input.
pub const INPUT_GROUP_INPUT_CONTROL: &str = "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0";

/// Appended to the shared `TEXTAREA_BASE` for a group-embedded textarea.
pub const INPUT_GROUP_TEXTAREA_CONTROL: &str = "flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0";

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum InputGroupAddonAlign {
	#[tw(default, class = "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]")]
	InlineStart,
	#[tw(class = "order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]")]
	InlineEnd,
	#[tw(class = "order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3 group-has-[>input]/input-group:pt-2.5")]
	BlockStart,
	#[tw(class = "order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3 group-has-[>input]/input-group:pb-2.5")]
	BlockEnd,
}

#[derive(Clone, Copy, Default, PartialEq)]
pub enum InputGroupButtonSize {
	#[default]
	Xs,
	Sm,
}

/// Size × icon → shadcn's flat `xs`/`sm`/`icon-xs`/`icon-sm` keys. Mirrors the TS
/// `inputGroupButtonSizes` table; an icon button is a square (`size-N p-0`).
pub fn input_group_button_size_class(size: InputGroupButtonSize, icon: bool) -> &'static str {
	match (size, icon) {
		(InputGroupButtonSize::Xs, false) => "h-6 gap-1 px-2 rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-3.5 has-[>svg]:px-2",
		(InputGroupButtonSize::Sm, false) => "h-8 px-2.5 gap-1.5 rounded-md has-[>svg]:px-2.5",
		(InputGroupButtonSize::Xs, true) => "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
		(InputGroupButtonSize::Sm, true) => "size-8 p-0 has-[>svg]:p-0",
	}
}
