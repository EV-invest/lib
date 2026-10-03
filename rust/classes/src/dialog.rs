/// On the content's 200ms clock and holding its last exit frame — see `SHEET_OVERLAY` for the flash this prevents.
pub const DIALOG_OVERLAY: &str = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                              data-[state=open]:fade-in-0 duration-200 data-[state=closed]:fill-mode-forwards data-[state=closed]:pointer-events-none fixed inset-0 z-50 bg-black/50";
pub const DIALOG_CONTENT: &str = "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                              data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] \
                              left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg \
                              border border-border p-6 shadow-lg duration-200 data-[state=closed]:fill-mode-forwards outline-hidden sm:max-w-lg";
/// `focus-visible`, not `focus`: with nothing else focusable the close button takes focus on a mouse open, where a ring is noise.
pub const DIALOG_CLOSE: &str = "ring-offset-background focus-visible:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity \
                            hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none \
                            [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
pub const DIALOG_HEADER: &str = "flex flex-col gap-2 text-center sm:text-left";
pub const DIALOG_FOOTER: &str = "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end";
pub const DIALOG_TITLE: &str = "text-lg leading-none font-semibold";
pub const DIALOG_DESCRIPTION: &str = "text-ink-soft text-sm";
