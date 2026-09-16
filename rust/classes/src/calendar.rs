/// No background of its own: the host paints it (`bg-popover` inside a
/// popover, the page elsewhere), so the grid never draws a second box.
pub const CALENDAR_ROOT: &str = "p-3 w-fit";

pub const CALENDAR_NAV_BUTTON: &str = "size-8 p-0 select-none";

pub const CALENDAR_NAV: &str = "flex items-center justify-between gap-1 w-full px-1";

pub const CALENDAR_CAPTION: &str = "text-sm font-medium select-none";

pub const CALENDAR_GRID: &str = "w-full border-collapse mt-4";

pub const CALENDAR_WEEKDAY_ROW: &str = "flex";

// Columns are a fixed 36px (`size-9`) so the width never depends on the
// locale's weekday labels; the height is fixed by the six-week grid both
// components always render.
pub const CALENDAR_WEEKDAY: &str = "text-ink-soft rounded-md w-9 shrink-0 font-normal text-[0.8rem] select-none";

pub const CALENDAR_WEEK: &str = "flex w-full mt-2";

pub const CALENDAR_DAY_EMPTY: &str = "relative size-9 shrink-0 p-0 select-none";

pub const CALENDAR_DAY_CELL: &str = "relative size-9 shrink-0 p-0 text-center select-none";

pub const CALENDAR_DAY: &str = "size-auto w-full aspect-square font-normal leading-none tabular-nums";

pub const CALENDAR_DAY_SELECTED: &str = "bg-primary text-on-primary";

pub const CALENDAR_DAY_TODAY: &str = "bg-hover text-ink rounded-md";
