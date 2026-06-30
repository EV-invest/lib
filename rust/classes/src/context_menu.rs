pub const CONTEXT_MENU_CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out \
                       data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 \
                       data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                       data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] \
                       origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md \
                       border p-1 shadow-md";
pub const CONTEXT_MENU_SUB_CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out \
                           data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 \
                           data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                           data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] \
                           origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg";
pub const CONTEXT_MENU_ITEM: &str = "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive \
                    data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive \
                    data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground \
                    relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none \
                    data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none \
                    [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
pub const CONTEXT_MENU_CHECK_ITEM: &str = "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm \
                          py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none \
                          data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
pub const CONTEXT_MENU_SUB_TRIGGER: &str = "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent \
                           data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex \
                           cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none \
                           data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
pub const CONTEXT_MENU_LABEL: &str = "text-foreground px-2 py-1.5 text-sm font-medium data-[inset]:pl-8";
pub const CONTEXT_MENU_SEPARATOR: &str = "bg-border -mx-1 my-1 h-px";
pub const CONTEXT_MENU_SHORTCUT: &str = "text-muted-foreground ml-auto text-xs tracking-widest";
