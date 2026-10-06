use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		Size, ToggleVariant,
		primitives::{Controllable, use_controllable},
		toggle::toggle_classes,
	},
};

/// `Single` keeps at most one item pressed; `Multiple` allows several.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ToggleGroupType {
	#[default]
	Single,
	Multiple,
}

/// Grouped container that owns the selection, like the TS port: items carry a
/// `value` and read their pressed state from the group.
///
/// The selection is a `Vec<String>` for both types — `Single` simply never holds
/// more than one — so `value`, `default_value` and `on_value_change` keep one
/// shape whichever `type` the group has (the mirror of the TS `toArray`).
/// Pressing the selected item of a `Single` group clears it, as in TS.
#[component]
pub fn ToggleGroup(
	#[props(default)] r#type: ToggleGroupType,
	value: Option<Vec<String>>,
	#[props(default)] default_value: Vec<String>,
	on_value_change: Option<EventHandler<Vec<String>>>,
	#[props(default)] variant: ToggleVariant,
	#[props(default)] size: Size,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let selected = use_controllable(value, default_value, on_value_change);
	let look = GroupLook { kind: r#type, variant, size };
	let mut shared = use_signal(|| look);
	// Synced every render, not captured once, so a group whose `type`, `variant`
	// or `size` prop changes restyles its items — the same pattern as
	// `use_controllable`'s controlled value.
	if *shared.peek() != look {
		shared.set(look);
	}
	use_context_provider(|| ToggleGroupCtx { selected, look: shared });
	let cls = cn!("group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs", class);
	rsx! {
		div {
			class: cls,
			"data-slot": "toggle-group",
			"data-variant": variant.as_ref(),
			"data-size": size.as_ref(),
			{children}
		}
	}
}
/// A single selectable item. Reuses [`toggle_classes`] then layers the group
/// adjacency utilities.
///
/// With a `value` inside a [`ToggleGroup`] the group owns its state, and
/// `pressed`/`default_pressed`/`on_pressed_change` are ignored. Without a
/// `value` (or outside a group) it is a standalone controllable toggle, as
/// before the group owned selection.
///
/// `variant`/`size` default to the group's; an explicit one wins. (TS lets the
/// group always win, which leaves the item props dead.)
///
/// `flex-auto`, not shadcn's `flex-1`: the group is `w-fit`, and basis-0 items make
/// Chrome split it into equal columns, so a longer label overflows its cell.
#[component]
pub fn ToggleGroupItem(
	value: Option<String>,
	variant: Option<ToggleVariant>,
	size: Option<Size>,
	#[props(default)] class: String,
	#[props(default)] disabled: bool,
	pressed: Option<bool>,
	#[props(default)] default_pressed: bool,
	on_pressed_change: Option<EventHandler<bool>>,
	children: Element,
) -> Element {
	let own = use_controllable(pressed, default_pressed, on_pressed_change);
	let group = try_use_context::<ToggleGroupCtx>();
	let look = group.map(|g| *g.look.read());
	let variant = variant.or(look.map(|l| l.variant)).unwrap_or_default();
	let size = size.or(look.map(|l| l.size)).unwrap_or_default();
	let driver = match (group, value) {
		(Some(group), Some(value)) => Driver::Group { group, value },
		_ => Driver::Own(own),
	};
	let on = driver.is_on();
	let cls = cn!(
		toggle_classes(&variant, size, ""),
		"min-w-0 flex-auto shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:-ml-px data-[variant=outline]:first:ml-0 data-[state=on]:z-10",
		class
	);
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "toggle-group-item",
			"data-variant": variant.as_ref(),
			"data-size": size.as_ref(),
			"data-state": if on { "on" } else { "off" },
			"aria-pressed": on,
			disabled,
			onclick: move |_| driver.press(),
			{children}
		}
	}
}

#[derive(Clone, Copy, PartialEq)]
struct GroupLook {
	kind: ToggleGroupType,
	variant: ToggleVariant,
	size: Size,
}

#[derive(Clone, Copy)]
struct ToggleGroupCtx {
	selected: Controllable<Vec<String>>,
	look: Signal<GroupLook>,
}

impl ToggleGroupCtx {
	fn is_on(&self, value: &str) -> bool {
		self.selected.get().iter().any(|v| v == value)
	}

	/// Reads the selection at click time, not render time, so presses that land
	/// before the next render still compose.
	fn toggle(&self, value: &str) {
		let current = self.selected.get();
		let present = current.iter().any(|v| v == value);
		let next = match self.look.peek().kind {
			ToggleGroupType::Single =>
				if present {
					Vec::new()
				} else {
					vec![value.to_owned()]
				},
			ToggleGroupType::Multiple =>
				if present {
					current.into_iter().filter(|v| v != value).collect()
				} else {
					let mut next = current;
					next.push(value.to_owned());
					next
				},
		};
		self.selected.set(next);
	}
}

/// Who owns an item's pressed state.
#[derive(Clone)]
enum Driver {
	Group { group: ToggleGroupCtx, value: String },
	Own(Controllable<bool>),
}

impl Driver {
	fn is_on(&self) -> bool {
		match self {
			Self::Group { group, value } => group.is_on(value),
			Self::Own(own) => own.get(),
		}
	}

	fn press(&self) {
		match self {
			Self::Group { group, value } => group.toggle(value),
			Self::Own(own) => own.set(!own.get()),
		}
	}
}

#[cfg(test)]
mod tests {
	use std::cell::RefCell;

	use super::*;
	use crate::uikit::test_util::{render, render_after_click};

	#[test]
	fn group_renders_slot_and_variant() {
		fn app() -> Element {
			rsx! {
				ToggleGroup { variant: ToggleVariant::Outline, "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"toggle-group\""), "{html}");
		assert!(html.contains("data-variant=\"outline\""), "{html}");
	}

	#[test]
	fn item_reuses_toggle_classes_and_adjacency() {
		fn app() -> Element {
			rsx! {
				ToggleGroupItem { size: Size::Sm, "A" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"toggle-group-item\""), "{html}");
		assert!(html.contains("first:rounded-l-md"), "{html}");
		assert!(html.contains("h-8"), "{html}");
	}

	#[test]
	fn item_controlled_pressed_renders_on() {
		fn app() -> Element {
			rsx! {
				ToggleGroupItem { pressed: true, "A" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-state=\"on\""), "{html}");
	}

	/// `data-state` of each item, in document order.
	fn states(html: &str) -> Vec<&str> {
		html.split("data-state=\"").skip(1).filter_map(|s| s.split('"').next()).collect()
	}

	#[test]
	fn default_value_presses_matching_items_only() {
		fn app() -> Element {
			rsx! {
				ToggleGroup { r#type: ToggleGroupType::Multiple, default_value: vec!["a".to_string(), "c".to_string()],
					ToggleGroupItem { value: "a", "A" }
					ToggleGroupItem { value: "b", "B" }
					ToggleGroupItem { value: "c", "C" }
				}
			}
		}
		let html = render(app);
		assert_eq!(states(&html), ["on", "off", "on"], "{html}");
		assert_eq!(html.matches("aria-pressed=true").count(), 2, "{html}");
	}

	#[test]
	fn items_inherit_group_look_unless_set() {
		fn app() -> Element {
			rsx! {
				ToggleGroup { variant: ToggleVariant::Outline, size: Size::Sm,
					ToggleGroupItem { value: "a", "A" }
					ToggleGroupItem { value: "b", variant: ToggleVariant::Bare, size: Size::Lg, "B" }
				}
			}
		}
		let html = render(app);
		let items: Vec<&str> = html.split("data-slot=\"toggle-group-item\"").skip(1).collect();
		assert_eq!(items.len(), 2, "{html}");
		assert!(items[0].contains("data-variant=\"outline\"") && items[0].contains("data-size=\"sm\""), "{html}");
		assert!(items[1].contains("data-variant=\"bare\"") && items[1].contains("data-size=\"lg\""), "{html}");
	}

	thread_local! {
		static EMITTED: RefCell<Vec<Vec<String>>> = const { RefCell::new(Vec::new()) };
	}
	fn record(v: Vec<String>) {
		EMITTED.with(|e| e.borrow_mut().push(v));
	}
	fn emitted() -> Vec<Vec<String>> {
		EMITTED.with(|e| e.take())
	}

	#[test]
	fn single_click_selects_one_and_moves_selection() {
		// The sweep presses A then B: a single group ends with only B.
		fn app() -> Element {
			rsx! {
				ToggleGroup { on_value_change: record,
					ToggleGroupItem { value: "a", "A" }
					ToggleGroupItem { value: "b", "B" }
				}
			}
		}
		let html = render_after_click(app);
		assert_eq!(states(&html), ["off", "on"], "{html}");
		assert_eq!(emitted(), [vec!["a".to_string()], vec!["b".to_string()]]);
	}

	#[test]
	fn single_click_on_selected_item_clears_it() {
		fn app() -> Element {
			rsx! {
				ToggleGroup { default_value: vec!["a".to_string()], on_value_change: record,
					ToggleGroupItem { value: "a", "A" }
				}
			}
		}
		let html = render_after_click(app);
		assert_eq!(states(&html), ["off"], "{html}");
		assert_eq!(emitted(), [Vec::<String>::new()]);
	}

	#[test]
	fn multiple_click_accumulates_and_removes() {
		// A starts pressed and is released; B is added.
		fn app() -> Element {
			rsx! {
				ToggleGroup {
					r#type: ToggleGroupType::Multiple,
					default_value: vec!["a".to_string()],
					on_value_change: record,
					ToggleGroupItem { value: "a", "A" }
					ToggleGroupItem { value: "b", "B" }
					ToggleGroupItem { value: "c", "C" }
				}
			}
		}
		let html = render_after_click(app);
		assert_eq!(states(&html), ["off", "on", "on"], "{html}");
		assert_eq!(emitted(), [Vec::<String>::new(), vec!["b".to_string()], vec!["b".to_string(), "c".to_string()]]);
	}

	#[test]
	fn controlled_value_reports_but_does_not_move() {
		fn app() -> Element {
			rsx! {
				ToggleGroup { value: vec!["a".to_string()], on_value_change: record,
					ToggleGroupItem { value: "a", "A" }
				}
			}
		}
		let html = render_after_click(app);
		assert_eq!(states(&html), ["on"], "{html}");
		assert_eq!(emitted(), [Vec::<String>::new()]);
	}

	#[test]
	fn item_without_value_keeps_its_own_pressed_state() {
		fn app() -> Element {
			rsx! {
				ToggleGroup { value: Vec::<String>::new(),
					ToggleGroupItem { "Legacy" }
				}
			}
		}
		let html = render_after_click(app);
		assert_eq!(states(&html), ["on"], "{html}");
	}
}
