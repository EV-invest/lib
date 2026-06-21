use dioxus::prelude::*;
use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::cn;

#[derive(PartialEq, TwVariant)]
#[tw(class = "relative w-full rounded-lg border px-4 py-3 text-sm grid \
              has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] \
              has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 \
              [&>svg]:text-current")]
pub enum AlertVariant {
	#[tw(default, class = "bg-card text-card-foreground")]
	Default,
	#[tw(class = "text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90")]
	Destructive,
}

#[component]
pub fn Alert(#[props(default)] variant: AlertVariant, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(variant.as_class(), class);
	rsx! {
		div { class: cls, "data-slot": "alert", role: "alert", {children} }
	}
}

#[component]
pub fn AlertTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", class);
	rsx! {
		div { class: cls, "data-slot": "alert-title", {children} }
	}
}

#[component]
pub fn AlertDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed", class);
	rsx! {
		div { class: cls, "data-slot": "alert-description", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn default_variant_renders_base_and_slot() {
		fn app() -> Element {
			rsx! { Alert { "body" } }
		}
		let html = render(app);
		assert!(html.contains("bg-card"), "{html}");
		assert!(html.contains("data-slot=\"alert\""), "{html}");
		assert!(html.contains("role=\"alert\""), "{html}");
		assert!(html.contains("body"));
	}

	#[test]
	fn destructive_variant() {
		fn app() -> Element {
			rsx! {
				Alert { variant: AlertVariant::Destructive, "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("text-destructive"), "{html}");
	}

	#[test]
	fn title_and_description_slots() {
		fn app() -> Element {
			rsx! {
				Alert {
					AlertTitle { "t" }
					AlertDescription { "d" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"alert-title\""), "{html}");
		assert!(html.contains("data-slot=\"alert-description\""), "{html}");
		assert!(html.contains("text-muted-foreground"), "{html}");
	}
}
