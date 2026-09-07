use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const SECTION_BASE: &str = "w-full px-[var(--page-px)]";
pub const SECTION_PY: &str = "py-[var(--band-py)]";
pub const SECTION_PY_TIGHT: &str = "py-[var(--band-py-tight)]";
pub const SECTION_HEAD: &str = "flex flex-col gap-2 md:gap-3.5";
pub const EYEBROW: &str = "font-medium text-[10px] md:text-[11.5px] tracking-[0.15em] md:tracking-[0.16em] text-primary";
/// `cn!` merges every `font-*` utility as one group, so a `font-bold` here would
/// take the family down with it the moment a caller overrides anything — hence
/// the weight as a property.
pub const DISPLAY_BASE: &str = "font-display [font-weight:700] max-w-[54rem] tracking-[-0.005em] leading-[1.16] md:leading-[1.14] \
                                text-[calc(1.5625rem*var(--display-scale))] md:text-[calc(2.625rem*var(--display-scale))]";
/// The paragraph directly under a [`DISPLAY_BASE`] headline — one step up from
/// [`PROSE`], which is body copy.
pub const LEDE: &str = "max-w-[52rem] text-[15px] md:text-[17px] leading-[1.58] text-ink-soft";
pub const PROSE: &str = "text-[14px] md:text-[15px] leading-[1.62] text-ink-soft";
pub const STAT: &str = "flex items-center gap-[7px] whitespace-nowrap";
pub const STAT_FIGURE: &str = "font-semibold";
pub const STAT_LABEL: &str = "text-ink-soft";
pub const CHECK: &str = "font-semibold text-positive";
/// Which token scope a band sets on itself. Custom properties inherit, so the
/// class re-themes the whole subtree: `bg-card text-ink` is then correct on both
/// sides with no prop threading. A consumer that defines only `:root` gets a
/// no-op either way.
#[derive(Debug, PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum Polarity {
	#[tw(default, class = "light")]
	Light,
	#[tw(class = "dark")]
	Dark,
}

/// Which plane a band sits on, within its polarity.
#[derive(Debug, PartialEq, TwVariant, strum::AsRefStr, strum::EnumIter)]
#[strum(serialize_all = "kebab-case")]
pub enum Surface {
	#[tw(default, class = "bg-background text-ink")]
	Background,
	#[tw(class = "bg-card text-ink")]
	Card,
	#[tw(class = "bg-muted text-ink")]
	Muted,
	/// The action band. Neither polarity derives what reads on a filled role, so
	/// this one names its pairing.
	#[tw(class = "bg-primary text-on-primary")]
	Primary,
}
