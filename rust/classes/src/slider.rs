pub const SLIDER_ROOT: &str = "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 \
                               data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 \
                               data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col";
pub const SLIDER_TRACK: &str = "bg-muted relative grow overflow-hidden rounded-full \
                                data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full \
                                data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5";
pub const SLIDER_RANGE: &str = "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full";
pub const SLIDER_THUMB: &str = "border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm \
                                transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden \
                                disabled:pointer-events-none disabled:opacity-50";
