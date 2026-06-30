//! Pure styling data for the uikit: Tailwind class tables, variant/size enums and
//! the `cn!` fuse macro. Carries no Dioxus — it's the single source of truth that
//! both the Rust components (`ev_lib`) and the TS codegen (`ev_lib_gen`) read from.

mod button;
mod size;

pub use button::{BUTTON_BASE, ButtonVariant, button_size_class};
pub use size::Size;

/// Fuses any number of class fragments into a single `String` with real Tailwind
/// conflict resolution (like `clsx` + `tailwind-merge`): empty fragments drop, the
/// rightmost conflicting utility wins. The TS mirror is `cn` in `@evinvest/uikit`.
#[macro_export]
macro_rules! cn {
	($($frag:expr),* $(,)?) => {
		::tailwind_fuse::tw_merge!($($frag),*)
	};
}

#[cfg(test)]
mod tests {
	#[test]
	fn joins_distinct_classes() {
		assert_eq!(cn!("flex", "items-center", "justify-center"), "flex items-center justify-center");
	}

	#[test]
	fn rightmost_wins_on_conflict() {
		assert_eq!(cn!("p-4", "p-2"), "p-2");
		assert_eq!(cn!("bg-primary", "bg-secondary"), "bg-secondary");
	}

	#[test]
	fn keeps_refinements() {
		assert_eq!(cn!("p-4", "py-2"), "p-4 py-2");
	}

	#[test]
	fn drops_empty_fragments() {
		assert_eq!(cn!("px-2", "", "py-1"), "px-2 py-1");
		assert_eq!(cn!(""), "");
	}

	#[test]
	fn mixes_str_and_owned_override() {
		let base = "h-9 px-4 py-2";
		let class = String::from("px-6");
		assert_eq!(cn!(base, class), "h-9 py-2 px-6");
	}

	#[test]
	fn trailing_comma_and_single_fragment() {
		assert_eq!(cn!("rounded-md",), "rounded-md");
	}
}
