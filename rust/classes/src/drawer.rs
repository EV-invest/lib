use tailwind_fuse::{AsTailwindClass, TwVariant};

// Enter/exit motion lives in motion.css, keyed on `data-slot="drawer-content"` +
// `data-vaul-drawer-direction` + `data-state`; no tw-animate-css utilities here,
// and no Tailwind `transition` either — it would fight the motion.css `transform`
// transition at equal specificity.
pub const DRAWER_CONTENT_BASE: &str = "bg-background fixed z-50 flex h-auto border border-border";

/// Scrim behind the panel; its fade is motion.css, keyed on `data-slot="drawer-overlay"` + `data-state`.
pub const DRAWER_OVERLAY: &str = "fixed inset-0 z-50 bg-black/50";

/// Drag affordance, rendered for the bottom direction only.
pub const DRAWER_HANDLE: &str = "bg-muted mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full";

/// The panel is `touch-action: none` (motion.css), so scrolling lives in this inner body; the handle stays pinned above it.
pub const DRAWER_BODY: &str = "flex min-h-0 flex-1 flex-col overflow-y-auto";

pub const DRAWER_HEADER: &str = "flex flex-col gap-0.5 p-4 text-center sm:gap-1.5 sm:text-left";

pub const DRAWER_FOOTER: &str = "mt-auto flex flex-col gap-2 p-4";

pub const DRAWER_TITLE: &str = "text-ink font-semibold";

pub const DRAWER_DESCRIPTION: &str = "text-ink-soft text-sm";

/// Edge the drawer is docked to. Layout only — the slide from that edge is motion.css,
/// keyed on `data-vaul-drawer-direction`. The shared content base rides on [`DRAWER_CONTENT_BASE`].
#[derive(PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum DrawerDirection {
	#[tw(default, class = "inset-x-0 bottom-0 mt-24 max-h-[80vh] flex-col rounded-t-lg border-b-0")]
	Bottom,
	#[tw(class = "inset-x-0 top-0 mb-24 max-h-[80vh] flex-col rounded-b-lg border-t-0")]
	Top,
	#[tw(class = "inset-y-0 left-0 w-3/4 flex-row border-r sm:max-w-sm")]
	Left,
	#[tw(class = "inset-y-0 right-0 w-3/4 flex-row border-l sm:max-w-sm")]
	Right,
}
