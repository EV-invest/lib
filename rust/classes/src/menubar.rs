pub const MENUBAR_ROOT: &str = "bg-background flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs";
pub const MENUBAR_TRIGGER: &str = "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent \
                       data-[state=open]:text-accent-foreground flex items-center rounded-sm px-2 py-1 text-sm \
                       font-medium outline-hidden select-none";
pub const MENUBAR_CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 \
                       data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 \
                       data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                       data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 absolute z-50 \
                       min-w-[12rem] overflow-hidden rounded-md border p-1 shadow-md";
pub const MENUBAR_ITEM: &str = "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive \
                    data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive \
                    data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground \
                    relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden \
                    select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 \
                    [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
pub const MENUBAR_CHECKBOX_ITEM: &str = "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 \
                             rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none \
                             data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none \
                             [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
pub const MENUBAR_RADIO_ITEM: &str = "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 \
                          rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none \
                          data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none \
                          [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
pub const MENUBAR_ITEM_INDICATOR: &str = "pointer-events-none absolute left-2 flex size-3.5 items-center justify-center";
pub const MENUBAR_LABEL: &str = "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8";
pub const MENUBAR_SEPARATOR: &str = "bg-border -mx-1 my-1 h-px";
pub const MENUBAR_SHORTCUT: &str = "text-muted-foreground ml-auto text-xs tracking-widest";
pub const MENUBAR_SUB_TRIGGER: &str = "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent \
                           data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 \
                           text-sm outline-none select-none data-[inset]:pl-8";
pub const MENUBAR_SUB_CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out \
                           data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 \
                           data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 \
                           data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 \
                           data-[side=top]:slide-in-from-bottom-2 absolute z-50 min-w-[8rem] overflow-hidden rounded-md \
                           border p-1 shadow-lg";
