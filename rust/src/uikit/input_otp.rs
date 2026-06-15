use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, use_controllable},
};

#[component]
pub fn InputOTP(
	max_length: usize,
	value: Option<String>,
	#[props(default)] default_value: String,
	on_change: Option<EventHandler<String>>,
	#[props(default)] class: String,
	#[props(default)] container_class: String,
	#[props(default)] disabled: bool,
	children: Element,
) -> Element {
	let value = use_controllable(value, default_value, on_change);
	let active_index = use_signal(|| None::<usize>);
	use_context_provider(|| InputOtpContext { value, active_index });

	let current = value.get();
	let container_cls = cn!("relative flex items-center gap-2 has-disabled:opacity-50", container_class);
	let input_cls = cn!("absolute inset-0 h-full w-full opacity-0 disabled:cursor-not-allowed", class);
	rsx! {
		div { class: container_cls, "data-slot": "input-otp",
			{children}
			input {
				inputmode: "numeric",
				autocomplete: "one-time-code",
				maxlength: max_length as i64,
				value: current,
				disabled,
				class: input_cls,
				oninput: move |e| {
						let next: String = e.value().chars().take(max_length).collect();
						value.set(next);
				},
				onfocus: move |_| {
						let mut a = active_index;
						let len = value.get().chars().count();
						a.set(Some(len.min(max_length.saturating_sub(1))));
				},
				onblur: move |_| {
						let mut a = active_index;
						a.set(None);
				},
			}
		}
	}
}
#[component]
pub fn InputOTPGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex items-center", class);
	rsx! {
		div { class: cls, "data-slot": "input-otp-group", {children} }
	}
}
#[component]
pub fn InputOTPSlot(index: usize, #[props(default)] class: String) -> Element {
	let ctx = use_context::<InputOtpContext>();
	let value = ctx.value.get();
	let char = value.chars().nth(index);
	let is_active = (ctx.active_index)() == Some(index);
	let has_fake_caret = is_active && char.is_none();

	let cls = cn!(
		"data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 \
		 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive border-input relative flex h-9 \
		 w-9 items-center justify-center border-y border-r text-sm shadow-xs transition-all outline-none first:rounded-l-md \
		 first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]",
		class
	);
	rsx! {
		div {
			class: cls,
			"data-slot": "input-otp-slot",
			"data-active": is_active,
			{char.map(|c| c.to_string())}
			if has_fake_caret {
				div { class: "pointer-events-none absolute inset-0 flex items-center justify-center",
					div { class: "animate-caret-blink bg-foreground h-4 w-px duration-1000" }
				}
			}
		}
	}
}
#[component]
pub fn InputOTPSeparator() -> Element {
	rsx! {
		div { "data-slot": "input-otp-separator", role: "separator",
			svg {
				xmlns: "http://www.w3.org/2000/svg",
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				stroke_linecap: "round",
				stroke_linejoin: "round",
				"aria-hidden": "true",
				path { d: "M5 12h14" }
			}
		}
	}
}
#[derive(Clone, Copy)]
struct InputOtpContext {
	value: Controllable<String>,
	active_index: Signal<Option<usize>>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn renders_hidden_input_and_group() {
		fn app() -> Element {
			rsx! {
				InputOTP { max_length: 4,
					InputOTPGroup {
						InputOTPSlot { index: 0 }
						InputOTPSlot { index: 1 }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"input-otp\""), "{html}");
		assert!(html.contains("data-slot=\"input-otp-group\""), "{html}");
		assert!(html.contains("data-slot=\"input-otp-slot\""), "{html}");
		assert!(html.contains("maxlength=4"), "{html}");
	}

	#[test]
	fn slot_shows_char_from_value() {
		fn app() -> Element {
			rsx! {
				InputOTP { max_length: 4, value: "ab".to_string(),
					InputOTPSlot { index: 0 }
					InputOTPSlot { index: 1 }
				}
			}
		}
		let html = render(app);
		assert!(html.contains(">a</div>"), "{html}");
		assert!(html.contains("data-active=false"), "{html}");
	}

	#[test]
	fn separator_renders_dash_path() {
		fn app() -> Element {
			rsx! { InputOTPSeparator {} }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"input-otp-separator\""), "{html}");
		assert!(html.contains("role=\"separator\""), "{html}");
		assert!(html.contains("M5 12h14"), "{html}");
	}

	#[test]
	fn slot_keeps_canonical_border_classes() {
		fn app() -> Element {
			rsx! {
				InputOTP { max_length: 4,
					InputOTPSlot { index: 0 }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("first:rounded-l-md"), "{html}");
		assert!(html.contains("last:rounded-r-md"), "{html}");
	}
}
