use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		INPUT_OTP_CONTAINER, INPUT_OTP_GROUP, INPUT_OTP_INPUT, INPUT_OTP_SLOT, INPUT_OTP_SLOT_CARET, INPUT_OTP_SLOT_CARET_WRAPPER,
		primitives::{Controllable, use_controllable},
	},
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
	let mut focused = use_signal(|| false);
	// Kept in a signal so slots re-derive when the prop changes (the context
	// struct itself is only built on the first render).
	let mut max_len = use_signal(|| max_length);
	if *max_len.peek() != max_length {
		max_len.set(max_length);
	}
	use_context_provider(|| InputOtpContext {
		value,
		focused,
		max_length: max_len,
	});

	let current = value.get();
	let container_cls = cn!(INPUT_OTP_CONTAINER, container_class);
	let input_cls = cn!(INPUT_OTP_INPUT, class);
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
				onfocus: move |_| focused.set(true),
				onblur: move |_| focused.set(false),
			}
		}
	}
}
#[component]
pub fn InputOTPGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(INPUT_OTP_GROUP, class);
	rsx! {
		div { class: cls, "data-slot": "input-otp-group", {children} }
	}
}
#[component]
pub fn InputOTPSlot(index: usize, #[props(default)] class: String) -> Element {
	let ctx = use_context::<InputOtpContext>();
	let value = ctx.value.get();
	let char = value.chars().nth(index);
	let is_active = ctx.active_index() == Some(index);
	let has_fake_caret = is_active && char.is_none();

	let cls = cn!(INPUT_OTP_SLOT, class);
	rsx! {
		div {
			class: cls,
			"data-slot": "input-otp-slot",
			"data-active": is_active,
			{char.map(|c| c.to_string())}
			if has_fake_caret {
				div { class: INPUT_OTP_SLOT_CARET_WRAPPER,
					div { class: INPUT_OTP_SLOT_CARET }
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
	focused: Signal<bool>,
	max_length: Signal<usize>,
}

impl InputOtpContext {
	/// The slot the next character lands in, derived on every render so the ring
	/// and caret follow typing. Mirrors the TS port's
	/// `focused ? Math.min(value.length, maxLength - 1) : -1`.
	fn active_index(&self) -> Option<usize> {
		if !(self.focused)() {
			return None;
		}
		let len = self.value.get().chars().count();
		Some(len.min((self.max_length)().saturating_sub(1)))
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::{render, render_focused};

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

	// `data-active` drives the ring, so the index of the slot carrying it is what
	// the user actually sees highlighted. Each chunk starts just after a slot's
	// marker attribute, so only the rest of that same tag is inspected.
	fn active_slot_of(html: &str) -> Option<usize> {
		html.split("data-slot=\"input-otp-slot\"").skip(1).position(|chunk| {
			let tag_end = chunk.find('>').unwrap_or(chunk.len());
			chunk[..tag_end].contains("data-active=true")
		})
	}

	#[test]
	fn active_slot_follows_the_typed_value() {
		// Nothing typed yet: the next char lands in slot 0.
		fn empty() -> Element {
			rsx! {
				InputOTP { max_length: 4,
					InputOTPSlot { index: 0 }
					InputOTPSlot { index: 1 }
					InputOTPSlot { index: 2 }
					InputOTPSlot { index: 3 }
				}
			}
		}
		let html = render_focused(empty);
		assert_eq!(active_slot_of(&html), Some(0), "{html}");
		assert!(html.contains(INPUT_OTP_SLOT_CARET), "the empty active slot shows the fake caret: {html}");

		// Two chars typed: the ring and caret must have moved to slot 2, which is
		// where the next digit actually lands.
		fn two_typed() -> Element {
			rsx! {
				InputOTP { max_length: 4, value: "12".to_string(),
					InputOTPSlot { index: 0 }
					InputOTPSlot { index: 1 }
					InputOTPSlot { index: 2 }
					InputOTPSlot { index: 3 }
				}
			}
		}
		let html = render_focused(two_typed);
		assert_eq!(active_slot_of(&html), Some(2), "the ring must follow the caret, not stay on slot 0: {html}");

		// Full: the active slot clamps to the last one and, being filled, shows no
		// caret (mirrors `Math.min(value.length, maxLength - 1)`).
		fn full() -> Element {
			rsx! {
				InputOTP { max_length: 4, value: "1234".to_string(),
					InputOTPSlot { index: 0 }
					InputOTPSlot { index: 1 }
					InputOTPSlot { index: 2 }
					InputOTPSlot { index: 3 }
				}
			}
		}
		let html = render_focused(full);
		assert_eq!(active_slot_of(&html), Some(3), "{html}");
		assert!(!html.contains(INPUT_OTP_SLOT_CARET), "a filled slot has no caret: {html}");
	}

	#[test]
	fn no_slot_is_active_while_unfocused() {
		fn app() -> Element {
			rsx! {
				InputOTP { max_length: 4, value: "12".to_string(),
					InputOTPSlot { index: 0 }
					InputOTPSlot { index: 1 }
				}
			}
		}
		let html = render(app);
		assert_eq!(active_slot_of(&html), None, "{html}");
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
