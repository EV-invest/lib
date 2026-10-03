/// The scrim runs on the panel's clock ([`SHEET_CONTENT`]): left on tw-animate's
/// 150ms default it finished fading first, and with fill-mode `none` snapped back
/// to full dark until the panel was unmounted — a flash on every close. Both hold
/// their last exit frame (`fill-mode-forwards`) for the same reason. A closing
/// scrim still covers the page for the length of its exit, so it stops taking
/// pointer events the moment it closes — the click right after a close lands on the page.
pub const SHEET_OVERLAY: &str = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                                 data-[state=open]:fade-in-0 data-[state=closed]:duration-300 data-[state=open]:duration-500 \
                                 data-[state=closed]:fill-mode-forwards data-[state=closed]:pointer-events-none fixed inset-0 z-50 bg-black/50";

/// `outline-hidden`: the TS port focuses the panel itself on open (`tabindex=-1`), and a ring round a whole panel says nothing.
pub const SHEET_CONTENT: &str = "bg-background border-border data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 \
                                 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 \
                                 data-[state=closed]:fill-mode-forwards outline-hidden";

/// `focus-visible`, not `focus`: the panel can hand focus here on a mouse open, where a ring is noise.
pub const SHEET_CLOSE: &str = "ring-offset-background focus-visible:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity \
                               hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none";

pub const SHEET_SIDE_RIGHT: &str = "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm";

pub const SHEET_SIDE_LEFT: &str = "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm";

pub const SHEET_SIDE_TOP: &str = "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b";

pub const SHEET_SIDE_BOTTOM: &str = "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t";

pub const SHEET_HEADER: &str = "flex flex-col gap-1.5 p-4";

pub const SHEET_FOOTER: &str = "mt-auto flex flex-col gap-2 p-4";

pub const SHEET_TITLE: &str = "text-ink font-semibold";

pub const SHEET_DESCRIPTION: &str = "text-ink-soft text-sm";
