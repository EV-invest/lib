use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const BADGE_BASE: &str = "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs \
                              font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden \
                              [&>svg]:size-3 [&>svg]:pointer-events-none transition-[color,box-shadow] \
                              focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] \
                              aria-invalid:ring-destructive/20 aria-invalid:border-destructive";

/// Canonical superset of the cabinet (`Success`) and landing variants.
#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum BadgeVariant {
	#[tw(default, class = "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90")]
	Default,
	#[tw(class = "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90")]
	Secondary,
	#[tw(class = "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20")]
	Destructive,
	#[tw(class = "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground")]
	Outline,
	#[tw(class = "border-transparent bg-main-accent-t2/20 text-main-accent-t2")]
	Success,
}
