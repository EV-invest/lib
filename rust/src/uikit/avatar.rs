use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{AVATAR, AVATAR_FALLBACK, AVATAR_IMAGE},
};

#[component]
pub fn Avatar(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(AVATAR, class);
	rsx! {
		div { class: cls, "data-slot": "avatar", {children} }
	}
}

#[component]
pub fn AvatarImage(#[props(default)] class: String, #[props(default)] src: String, #[props(default)] alt: String) -> Element {
	let mut errored = use_signal(|| false);
	if errored() {
		return rsx! {};
	}
	let cls = cn!(AVATAR_IMAGE, class);
	rsx! {
		img {
			class: cls,
			"data-slot": "avatar-image",
			src,
			alt,
			onerror: move |_| errored.set(true),
		}
	}
}

#[component]
pub fn AvatarFallback(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(AVATAR_FALLBACK, class);
	rsx! {
		div { class: cls, "data-slot": "avatar-fallback", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn avatar_renders_base_and_slot() {
		fn app() -> Element {
			rsx! {
				Avatar { "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("rounded-full"), "{html}");
		assert!(html.contains("data-slot=\"avatar\""), "{html}");
	}

	#[test]
	fn image_renders_src_and_slot() {
		fn app() -> Element {
			rsx! {
				AvatarImage { src: "a.png", alt: "me" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"avatar-image\""), "{html}");
		assert!(html.contains("aspect-square"), "{html}");
		assert!(html.contains("src=\"a.png\""), "{html}");
	}

	#[test]
	fn fallback_renders_base_and_slot() {
		fn app() -> Element {
			rsx! {
				AvatarFallback { "AB" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"avatar-fallback\""), "{html}");
		assert!(html.contains("bg-muted"), "{html}");
		assert!(html.contains("AB"));
	}
}
