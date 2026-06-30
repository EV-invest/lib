pub const SHEET_OVERLAY: &str = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                                 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50";

pub const SHEET_CONTENT: &str = "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 \
                                 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500";

pub const SHEET_CLOSE: &str = "ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity \
                               hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none";

pub const SHEET_SIDE_RIGHT: &str = "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm";

pub const SHEET_SIDE_LEFT: &str = "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm";

pub const SHEET_SIDE_TOP: &str = "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b";

pub const SHEET_SIDE_BOTTOM: &str = "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t";

pub const SHEET_HEADER: &str = "flex flex-col gap-1.5 p-4";

pub const SHEET_FOOTER: &str = "mt-auto flex flex-col gap-2 p-4";

pub const SHEET_TITLE: &str = "text-foreground font-semibold";

pub const SHEET_DESCRIPTION: &str = "text-muted-foreground text-sm";
