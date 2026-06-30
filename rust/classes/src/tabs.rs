pub const TABS_ROOT: &str = "flex flex-col gap-2";
pub const TABS_LIST: &str = "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]";
pub const TABS_TRIGGER: &str = "data-[state=active]:bg-background focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring \
                            text-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md \
                            border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] \
                            focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 \
                            data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
pub const TABS_CONTENT: &str = "flex-1 outline-none";
