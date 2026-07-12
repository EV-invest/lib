pub const CAROUSEL_CONTENT_VIEWPORT: &str = "overflow-hidden";

pub const CAROUSEL_CONTENT_TRACK: &str = "flex transition-transform";

pub const CAROUSEL_CONTENT_TRACK_HORIZONTAL: &str = "-ml-4";

pub const CAROUSEL_CONTENT_TRACK_VERTICAL: &str = "-mt-4 flex-col";

pub const CAROUSEL_ITEM: &str = "min-w-0 shrink-0 grow-0 basis-full";

pub const CAROUSEL_ITEM_HORIZONTAL: &str = "pl-4";

pub const CAROUSEL_ITEM_VERTICAL: &str = "pt-4";

pub const CAROUSEL_NAV: &str = "absolute size-8 rounded-full";

pub const CAROUSEL_PREVIOUS_HORIZONTAL: &str = "top-1/2 -left-12 -translate-y-1/2";

pub const CAROUSEL_PREVIOUS_VERTICAL: &str = "-top-12 left-1/2 -translate-x-1/2 rotate-90";

pub const CAROUSEL_NEXT_HORIZONTAL: &str = "top-1/2 -right-12 -translate-y-1/2";

pub const CAROUSEL_NEXT_VERTICAL: &str = "-bottom-12 left-1/2 -translate-x-1/2 rotate-90";

// Peak capped well below solid and spread over a wider band: a fully-opaque
// edge reads as a hard wall rather than a "more to come" hint. No opacity
// transition — cross-fading prev/next visibility left both edges tinted at
// once mid-swipe, which read as side shadows on every switch.
pub const CAROUSEL_EDGE_FADE_PREV: &str = "pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background/45 via-background/20 to-transparent";

pub const CAROUSEL_EDGE_FADE_NEXT: &str = "pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background/45 via-background/20 to-transparent";
