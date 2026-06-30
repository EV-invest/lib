pub const COMMAND_ROOT: &str = "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md";

pub const COMMAND_DIALOG_OVERLAY: &str = "fixed inset-0 z-50 bg-black/50";

pub const COMMAND_DIALOG_CONTENT: &str = "fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border p-0 shadow-lg";

pub const COMMAND_DIALOG_COMMAND: &str = "[&_[data-slot=command-input-wrapper]]:h-12 [&_[data-slot=command-input]]:h-12";

pub const COMMAND_INPUT_WRAPPER: &str = "flex h-9 items-center gap-2 border-b px-3";

pub const COMMAND_INPUT: &str = "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50";

pub const COMMAND_LIST: &str = "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto";

pub const COMMAND_EMPTY: &str = "py-6 text-center text-sm";

pub const COMMAND_GROUP: &str = "text-foreground [&_[data-slot=command-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[data-slot=command-group-heading]]:px-2 [&_[data-slot=command-group-heading]]:py-1.5 [&_[data-slot=command-group-heading]]:text-xs [&_[data-slot=command-group-heading]]:font-medium";

pub const COMMAND_ITEM: &str = "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

pub const COMMAND_SEPARATOR: &str = "bg-border -mx-1 h-px";

pub const COMMAND_SHORTCUT: &str = "text-muted-foreground ml-auto text-xs tracking-widest";
