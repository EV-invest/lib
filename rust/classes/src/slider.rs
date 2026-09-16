pub const SLIDER_ROOT: &str = "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 \
                               data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 \
                               data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col";
/// Muted, not a tint of the range: it is the one track that clears 1.3:1 on
/// every surface it sits on (1.33:1 vs card, 1.65:1 vs background) while the
/// ink range still reads on it at 3.54:1 — an alpha tint would trade one floor
/// for the other.
pub const SLIDER_TRACK: &str = "bg-muted relative grow overflow-hidden rounded-full \
                                data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full \
                                data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5";
/// The ink, not the fill: a range carries no label, so like the radio dot it is
/// identified by contrast alone, and the fill (`--primary`) holds only 2.54:1
/// on the muted track against the ink's 3.54:1 (docs/spec/accents.md).
pub const SLIDER_RANGE: &str = "bg-primary-ink absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full";
/// An outline adjoining its own fill follows that fill — here the ink range the
/// thumb rides on.
pub const SLIDER_THUMB: &str = "border-primary-ink ring-ring/50 block size-4 shrink-0 rounded-full border bg-ink shadow-sm \
                                transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden \
                                disabled:pointer-events-none disabled:opacity-50";
