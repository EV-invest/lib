use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const BADGE_BASE: &str = "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs \
                              font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden \
                              [&>svg]:size-3 [&>svg]:pointer-events-none transition-[color,box-shadow] \
                              focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] \
                              aria-invalid:ring-accent-error/20 aria-invalid:border-accent-error";

/// Canonical superset of the cabinet (`Success`) and landing variants.
///
/// A badge only takes focus as a link; the filled variants then wear
/// [`FILLED_FOCUS_RING`](crate::FILLED_FOCUS_RING) instead of the base's halo.
#[derive(PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum BadgeVariant {
	#[tw(
		default,
		class = "border-transparent bg-primary text-on-primary [a&]:hover:bg-primary/90 focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	)]
	Primary,
	#[tw(
		class = "border-transparent bg-secondary text-on-secondary [a&]:hover:bg-secondary/90 focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	)]
	Secondary,
	#[tw(
		class = "border-transparent bg-accent-error text-on-accent-error [a&]:hover:bg-accent-error/90 focus-visible:ring-accent-error/20 focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	)]
	Destructive,
	#[tw(class = "border-border text-ink [a&]:hover:bg-hover [a&]:hover:text-ink")]
	Outline,
	#[tw(class = "border-transparent bg-positive/20 text-positive")]
	Success,
}
