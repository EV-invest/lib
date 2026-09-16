/// A tint of the indicator's own ink, composited on card: #1a3b4d, 1.33:1
/// against card and 3.56:1 under the indicator; on background 1.29:1 / 4.54:1.
/// A tint of the fill (`bg-primary/20`) would sit at 1.23:1 vs card — an
/// invisible track — and hold only 2.75:1 under a fill indicator.
pub const PROGRESS_TRACK: &str = "bg-primary-ink/20 relative h-2 w-full overflow-hidden rounded-full";
/// The ink, not the fill: an indicator carries no label, so like the radio dot
/// it is identified by contrast alone (docs/spec/accents.md).
pub const PROGRESS_INDICATOR: &str = "bg-primary-ink h-full w-full flex-1 transition-all";
