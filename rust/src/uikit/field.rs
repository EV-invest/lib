use dioxus::prelude::*;

use crate::{cn, uikit::label::Label};

const FIELD_BASE: &str = "group/field flex w-full gap-3 data-[invalid=true]:text-destructive";
#[derive(derive_more::Display, Clone, Default, PartialEq)]
#[display(rename_all = "kebab-case")]
pub enum FieldOrientation {
	#[default]
	Vertical,
	Horizontal,
	Responsive,
}
impl FieldOrientation {
	fn class(&self) -> &'static str {
		match self {
			FieldOrientation::Vertical => "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
			FieldOrientation::Horizontal =>
				"flex-row items-center [&>[data-slot=field-label]]:flex-auto \
			                                 has-[>[data-slot=field-content]]:items-start \
			                                 has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
			FieldOrientation::Responsive =>
				"flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row \
			                                 @md/field-group:items-center @md/field-group:[&>*]:w-auto \
			                                 @md/field-group:[&>[data-slot=field-label]]:flex-auto \
			                                 @md/field-group:has-[>[data-slot=field-content]]:items-start \
			                                 @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
		}
	}
}

#[derive(derive_more::Display, Clone, Default, PartialEq)]
#[display(rename_all = "kebab-case")]
pub enum FieldLegendVariant {
	#[default]
	Legend,
	Label,
}

#[component]
pub fn FieldSet(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3", class);
	rsx! {
		fieldset { class: cls, "data-slot": "field-set", {children} }
	}
}

#[component]
pub fn FieldLegend(#[props(default)] variant: FieldLegendVariant, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("mb-3 font-medium data-[variant=legend]:text-base data-[variant=label]:text-sm", class);
	rsx! {
		legend { class: cls, "data-slot": "field-legend", "data-variant": "{variant}", {children} }
	}
}

#[component]
pub fn FieldGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(
		"group/field-group @container/field-group flex w-full flex-col gap-7 \
         data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
		class
	);
	rsx! {
		div { class: cls, "data-slot": "field-group", {children} }
	}
}

#[component]
pub fn Field(#[props(default)] orientation: FieldOrientation, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(FIELD_BASE, orientation.class(), class);
	rsx! {
		div {
			role: "group",
			class: cls,
			"data-slot": "field",
			"data-orientation": "{orientation}",
			{children}
		}
	}
}

#[component]
pub fn FieldContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("group/field-content flex flex-1 flex-col gap-1.5 leading-snug", class);
	rsx! {
		div { class: cls, "data-slot": "field-content", {children} }
	}
}

#[component]
pub fn FieldLabel(#[props(default)] class: String, #[props(default)] r#for: String, children: Element) -> Element {
	let cls = cn!(
		"group/field-label peer/field-label flex w-fit gap-2 leading-snug \
         group-data-[disabled=true]/field:opacity-50 has-[>[data-slot=field]]:w-full \
         has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border \
         [&>*]:data-[slot=field]:p-4 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary",
		class
	);
	rsx! {
		Label { class: cls, r#for, {children} }
	}
}

#[component]
pub fn FieldTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(
		"flex w-fit items-center gap-2 text-sm leading-snug font-medium \
         group-data-[disabled=true]/field:opacity-50",
		class
	);
	rsx! {
		div { class: cls, "data-slot": "field-label", {children} }
	}
}

#[component]
pub fn FieldDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(
		"text-muted-foreground text-sm leading-normal font-normal \
         group-has-[[data-orientation=horizontal]]/field:text-balance last:mt-0 nth-last-2:-mt-1 \
         [[data-variant=legend]+&]:-mt-1.5 [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
		class
	);
	rsx! {
		p { class: cls, "data-slot": "field-description", {children} }
	}
}

#[component]
pub fn FieldSeparator(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2", class);
	rsx! {
		div { class: cls, "data-slot": "field-separator", "data-content": "true",
			div { role: "separator", class: "absolute inset-0 top-1/2 shrink-0 bg-border h-px w-full" }
			span {
				class: "bg-background text-muted-foreground relative mx-auto block w-fit px-2",
				"data-slot": "field-separator-content",
				{children}
			}
		}
	}
}

#[component]
pub fn FieldError(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-destructive text-sm font-normal", class);
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
