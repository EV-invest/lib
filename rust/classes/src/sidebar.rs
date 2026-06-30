use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const SIDEBAR_MENU_BUTTON_BASE: &str = "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm \
                                            outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent \
                                            hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent \
                                            active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 \
                                            group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none \
                                            aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium \
                                            data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent \
                                            data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! \
                                            group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0";

pub const SIDEBAR_WRAPPER: &str = "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full";

pub const SIDEBAR_FLAT: &str = "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col";

pub const SIDEBAR_INNER: &str = "bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm";

pub const SIDEBAR_TRIGGER: &str = "inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground";

pub const SIDEBAR_RAIL: &str = "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex";

pub const SIDEBAR_INSET: &str = "bg-background relative flex w-full flex-1 flex-col md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2";

pub const SIDEBAR_HEADER: &str = "flex flex-col gap-2 p-2";

pub const SIDEBAR_FOOTER: &str = "flex flex-col gap-2 p-2";

pub const SIDEBAR_SEPARATOR: &str = "bg-sidebar-border mx-2 h-px w-auto shrink-0";

pub const SIDEBAR_CONTENT: &str = "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden";

pub const SIDEBAR_GROUP: &str = "relative flex w-full min-w-0 flex-col p-2";

pub const SIDEBAR_GROUP_LABEL: &str = "text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0";

pub const SIDEBAR_GROUP_CONTENT: &str = "w-full text-sm";

pub const SIDEBAR_MENU: &str = "flex w-full min-w-0 flex-col gap-1";

pub const SIDEBAR_MENU_ITEM: &str = "group/menu-item relative";

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum SidebarMenuButtonVariant {
	#[tw(default, class = "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")]
	Default,
	#[tw(
		class = "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]"
	)]
	Outline,
}

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum SidebarMenuButtonSize {
	#[tw(default, class = "h-8 text-sm")]
	Default,
	#[tw(class = "h-7 text-xs")]
	Sm,
	#[tw(class = "h-12 text-sm group-data-[collapsible=icon]:p-0!")]
	Lg,
}
