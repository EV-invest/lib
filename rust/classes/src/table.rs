pub const TABLE_CONTAINER: &str = "relative w-full overflow-x-auto";

pub const TABLE: &str = "w-full caption-bottom text-sm";

pub const TABLE_HEADER: &str = "[&_tr]:border-b";

pub const TABLE_BODY: &str = "[&_tr:last-child]:border-0";

pub const TABLE_FOOTER: &str = "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0";

pub const TABLE_ROW: &str = "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors";

pub const TABLE_HEAD: &str = "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap \
                             [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]";

pub const TABLE_CELL: &str = "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]";

pub const TABLE_CAPTION: &str = "text-muted-foreground mt-4 text-sm";
