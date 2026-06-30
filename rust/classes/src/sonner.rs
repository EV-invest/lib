use tailwind_fuse::{AsTailwindClass, TwVariant};

/// Base shared by every toast. The TS mirror appends its swipe-only utilities
/// (`touch-pan-y select-none`) on top — that styling is behaviour-specific and
/// stays in the React component (the Rust kit has no swipe-to-dismiss).
pub const TOAST_BASE: &str = "pointer-events-auto flex w-full items-start gap-3 rounded-md border p-4 text-sm shadow-lg";

pub const TOAST_CLOSE: &str = "text-foreground/50 hover:text-foreground shrink-0 transition-colors";

pub const TOAST_CONTENT: &str = "flex-1 space-y-1";

pub const TOAST_TITLE: &str = "font-medium";

/// Pinned stack container base; the per-position offsets ride on [`ToastPosition`].
pub const TOASTER_BASE: &str = "pointer-events-none fixed z-100 w-[calc(100%-2rem)] max-w-sm";

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum ToastVariant {
	#[tw(default, class = "bg-popover text-popover-foreground border-border")]
	Default,
	#[tw(class = "bg-popover text-popover-foreground border-main-accent-t2/40")]
	Success,
	#[tw(class = "bg-popover text-popover-foreground border-destructive/50")]
	Error,
	#[tw(class = "bg-popover text-popover-foreground border-border")]
	Info,
	#[tw(class = "bg-popover text-popover-foreground border-border")]
	Warning,
}

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum ToastPosition {
	#[tw(class = "top-4 left-4")]
	TopLeft,
	#[tw(class = "top-4 left-1/2 -translate-x-1/2")]
	TopCenter,
	#[tw(class = "top-4 right-4")]
	TopRight,
	#[tw(class = "bottom-4 left-4")]
	BottomLeft,
	#[tw(class = "bottom-4 left-1/2 -translate-x-1/2")]
	BottomCenter,
	#[tw(default, class = "bottom-4 right-4")]
	BottomRight,
}
