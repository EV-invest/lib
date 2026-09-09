use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const ALERT_BASE: &str = "relative w-full rounded-lg border px-4 py-3 text-sm grid \
                              has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] \
                              has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 \
                              [&>svg]:text-current";

pub const ALERT_TITLE: &str = "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight";

pub const ALERT_DESCRIPTION: &str = "text-ink-soft col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed";

#[derive(PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum AlertVariant {
	#[tw(default, class = "bg-card text-ink")]
	Default,
	#[tw(class = "text-accent-error bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-accent-error/90")]
	Destructive,
}
