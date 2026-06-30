pub const CARD: &str = "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm";

pub const CARD_HEADER: &str = "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 \
     has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6";

pub const CARD_TITLE: &str = "leading-none font-semibold";

pub const CARD_DESCRIPTION: &str = "text-muted-foreground text-sm";

pub const CARD_ACTION: &str = "col-start-2 row-span-2 row-start-1 self-start justify-self-end";

pub const CARD_CONTENT: &str = "px-6";

pub const CARD_FOOTER: &str = "flex items-center px-6 [.border-t]:pt-6";
