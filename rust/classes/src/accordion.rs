pub const ACCORDION_ITEM: &str = "border-b last:border-b-0";
pub const ACCORDION_HEADER: &str = "flex";
pub const ACCORDION_TRIGGER: &str = "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 \
                                 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline \
                                 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180";
pub const ACCORDION_CONTENT: &str = "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm";
pub const ACCORDION_CONTENT_INNER: &str = "pt-0 pb-4";
