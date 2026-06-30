use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		FIELD_BASE, FIELD_CONTENT, FIELD_DESCRIPTION, FIELD_ERROR, FIELD_GROUP, FIELD_LABEL, FIELD_LEGEND, FIELD_SEPARATOR, FIELD_SEPARATOR_CONTENT, FIELD_SEPARATOR_LINE, FIELD_SET,
		FIELD_TITLE, FieldOrientation, label::Label,
	},
};

#[derive(strum::AsRefStr, Clone, Default, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum FieldLegendVariant {
	#[default]
	Legend,
	Label,
}

#[component]
pub fn FieldSet(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(FIELD_SET, class);
	rsx! {
		fieldset { class: cls, "data-slot": "field-set", {children} }
	}
}

#[component]
pub fn FieldLegend(#[props(default)] variant: FieldLegendVariant, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(FIELD_LEGEND, class);
	rsx! {
		legend { class: cls, "data-slot": "field-legend", "data-variant": variant.as_ref(), {children} }
	}
}

#[component]
pub fn FieldGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(FIELD_GROUP, class);
	rsx! {
		div { class: cls, "data-slot": "field-group", {children} }
	}
}

#[component]
pub fn Field(#[props(default)] orientation: FieldOrientation, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(FIELD_BASE, orientation.as_class(), class);
	rsx! {
		div {
			role: "group",
			class: cls,
			"data-slot": "field",
			"data-orientation": orientation.as_ref(),
			{children}
		}
	}
}

#[component]
pub fn FieldContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(FIELD_CONTENT, class);
	rsx! {
		div { class: cls, "data-slot": "field-content", {children} }
	}
}

#[component]
pub fn FieldLabel(#[props(default)] class: String, #[props(default)] r#for: String, children: Element) -> Element {
	let cls = cn!(FIELD_LABEL, class);
	rsx! {
		Label { class: cls, r#for, {children} }
	}
}

#[component]
pub fn FieldTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(FIELD_TITLE, class);
	rsx! {
		div { class: cls, "data-slot": "field-label", {children} }
	}
}

#[component]
pub fn FieldDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(FIELD_DESCRIPTION, class);
	rsx! {
		p { class: cls, "data-slot": "field-description", {children} }
	}
}

#[component]
pub fn FieldSeparator(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(FIELD_SEPARATOR, class);
	rsx! {
		div { class: cls, "data-slot": "field-separator", "data-content": "true",
			div { role: "separator", class: FIELD_SEPARATOR_LINE }
			span {
				class: FIELD_SEPARATOR_CONTENT,
				"data-slot": "field-separator-content",
				{children}
			}
		}
	}
}

#[component]
pub fn FieldError(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(FIELD_ERROR, class);
	rsx! {
		div { role: "alert", class: cls, "data-slot": "field-error", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn field_default_is_vertical() {
		fn app() -> Element {
			rsx! { Field { "x" } }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"field\""), "{html}");
		assert!(html.contains("data-orientation=\"vertical\""), "{html}");
		assert!(html.contains("flex-col"), "{html}");
	}

	#[test]
	fn field_horizontal_orientation() {
		fn app() -> Element {
			rsx! {
				Field { orientation: FieldOrientation::Horizontal, "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-orientation=\"horizontal\""), "{html}");
		assert!(html.contains("flex-row"), "{html}");
	}

	#[test]
	fn field_label_wraps_label_slot() {
		fn app() -> Element {
			rsx! {
				FieldLabel { r#for: "n", "Name" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"label\""), "{html}");
		assert!(html.contains("peer/field-label"), "{html}");
		assert!(html.contains("for=\"n\""), "{html}");
	}

	#[test]
	fn legend_variant_data_attr() {
		fn app() -> Element {
			rsx! {
				FieldLegend { variant: FieldLegendVariant::Label, "L" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-variant=\"label\""), "{html}");
	}

	#[test]
	fn error_has_alert_role() {
		fn app() -> Element {
			rsx! {
				FieldError { "bad" }
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"alert\""), "{html}");
		assert!(html.contains("text-destructive"), "{html}");
		assert!(html.contains("bad"), "{html}");
	}

	#[test]
	fn separator_renders_content() {
		fn app() -> Element {
			rsx! {
				FieldSeparator { "or" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"field-separator\""), "{html}");
		assert!(html.contains("data-slot=\"field-separator-content\""), "{html}");
		assert!(html.contains("or"), "{html}");
	}
}
