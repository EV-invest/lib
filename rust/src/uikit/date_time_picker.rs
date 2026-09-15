use dioxus::{dioxus_core::needs_update, prelude::*};

use crate::{
	cn,
	uikit::{
		ButtonVariant, DATE_TIME_PICKER_CLEAR, DATE_TIME_PICKER_CONTENT, DATE_TIME_PICKER_TIME, DATE_TIME_PICKER_TIME_INPUT, DATE_TIME_PICKER_TIME_SEPARATOR, DATE_TIME_PICKER_TRIGGER,
		INPUT_BASE, POPOVER_CONTENT, Size,
		button::button_classes,
		calendar::{Calendar, CalendarDate},
		primitives::use_controllable,
	},
};

// lucide `calendar`, inlined per the kit's no-icon-dep convention.
const CALENDAR_ICON: [&str; 4] = ["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"];

/// A wall-clock moment with no zone: what the operator sees in the field.
///
/// Fields are declared in `date, hour, minute` order, so the derived ordering
/// is chronological.
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub struct LocalDateTime {
	pub date: CalendarDate,
	pub hour: u32,
	pub minute: u32,
}

impl LocalDateTime {
	pub fn new(date: CalendarDate, hour: u32, minute: u32) -> Self {
		Self { date, hour, minute }
	}

	/// Inclusive clamp at minute precision.
	fn clamp_to(self, min: Option<Self>, max: Option<Self>) -> Self {
		match (min, max) {
			(Some(lo), _) if self < lo => lo,
			(_, Some(hi)) if self > hi => hi,
			_ => self,
		}
	}

	/// The default trigger label: `YYYY-MM-DD HH:MM`, 24-hour.
	fn label(&self) -> String {
		format!("{:04}-{:02}-{:02} {:02}:{:02}", self.date.year, self.date.month, self.date.day, self.hour, self.minute)
	}

	/// The hidden form value: `YYYY-MM-DDTHH:MM` (no zone on this side).
	fn form_value(&self) -> String {
		format!("{:04}-{:02}-{:02}T{:02}:{:02}", self.date.year, self.date.month, self.date.day, self.hour, self.minute)
	}
}

/// The picker's own strings; every one defaults to English.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct DateTimePickerLabels {
	/// `aria-label` of the calendar's previous-month button; "Previous month".
	pub previous_month: Option<String>,
	/// `aria-label` of the calendar's next-month button; "Next month".
	pub next_month: Option<String>,
	/// `aria-label` of the hours input; "Hours".
	pub hours: Option<String>,
	/// `aria-label` of the minutes input; "Minutes".
	pub minutes: Option<String>,
	/// Text of the clear button; "Clear".
	pub clear: Option<String>,
	/// `aria-label` of the popover dialog; "Choose date and time".
	pub dialog: Option<String>,
}

/// A date + time field over the kit's own bricks: an outline trigger opening a
/// popover with the [`Calendar`] and two numeric hours/minutes inputs — no
/// native `datetime-local`, so the browser's locale popup never appears.
///
/// The parent owns the value (like `Calendar`'s `selected`); every edit reports
/// through `on_change`. The Rust kit has no clock, so with no `today` the grid
/// highlights nothing and a time typed before a day is chosen lands on `min`'s
/// day, else the first of the displayed month. The overlay is the inline Rust
/// popover (see the README "Limitations").
#[component]
pub fn DateTimePicker(
	/// The current value; `None` = empty.
	value: Option<LocalDateTime>,
	/// Fired with the next value (`None` when cleared).
	on_change: Option<EventHandler<Option<LocalDateTime>>>,
	/// Earliest allowed moment (inclusive, minute precision).
	min: Option<LocalDateTime>,
	/// Latest allowed moment (inclusive, minute precision).
	max: Option<LocalDateTime>,
	/// Overrides the trigger label; default `YYYY-MM-DD HH:MM`.
	format: Option<Callback<LocalDateTime, String>>,
	/// Shown on the trigger while empty.
	#[props(default)]
	placeholder: String,
	#[props(default)] labels: DateTimePickerLabels,
	#[props(default)] disabled: bool,
	/// Renders a hidden `<input name>` carrying `YYYY-MM-DDTHH:MM` (or "") for plain forms.
	name: Option<String>,
	/// "Today" for the calendar highlight and as the day a typed time lands on
	/// while empty.
	today: Option<CalendarDate>,
	open: Option<bool>,
	#[props(default)] default_open: bool,
	on_open_change: Option<EventHandler<bool>>,
	/// Fused onto the trigger.
	#[props(default)]
	class: String,
	/// Put on the trigger, so a `FieldLabel`'s `for` reaches it.
	id: Option<String>,
) -> Element {
	let open = use_controllable(open, default_open, on_open_change);
	let is_open = open.get();
	// `min` before `today`: a bound in the future would otherwise open on a fully
	// disabled grid.
	let mut month = use_signal(|| value.map(|v| v.date).or(min.map(|m| m.date)).or(today).unwrap_or(CalendarDate::new(2026, 6, 1)));

	let emit = move |next: Option<LocalDateTime>| {
		if let Some(h) = on_change {
			h.call(next);
		}
	};
	// The day a time lands on while no day is chosen.
	let fallback_day = move || today.or(min.map(|m| m.date)).unwrap_or_else(|| CalendarDate::new(month().year, month().month, 1));
	let base = move || value.unwrap_or_else(|| LocalDateTime::new(fallback_day(), 0, 0));

	let on_select = move |day: CalendarDate| {
		let (hour, minute) = value.map_or((0, 0), |v| (v.hour, v.minute));
		emit(Some(LocalDateTime::new(day, hour, minute).clamp_to(min, max)));
	};
	// The time fields are controlled, so every keystroke must leave the DOM on
	// the canonical "HH"/"MM" (as React does). Dioxus rewrites `input.value` on
	// every render — the attribute is volatile — but nothing re-renders the picker
	// when the emitted value did not change ("9" typed over "09") or when nothing
	// parsed (the field backspaced to empty): the parent sees the same props and
	// the picker is memoised, so the DOM would keep the raw keystrokes. Ask for
	// the render explicitly.
	let on_hours = move |e: FormEvent| {
		if let Some(hour) = parse_field(&e.value(), 23) {
			emit(Some(LocalDateTime { hour, ..base() }.clamp_to(min, max)));
		}
		needs_update();
	};
	let on_minutes = move |e: FormEvent| {
		if let Some(minute) = parse_field(&e.value(), 59) {
			emit(Some(LocalDateTime { minute, ..base() }.clamp_to(min, max)));
		}
		needs_update();
	};
	let on_clear = move |_| {
		emit(None);
		open.set(false);
	};
	// A focused field is replaced, not appended to: with the whole value
	// selected, "1" then "5" reads as 15. `eval` is a no-op without a document
	// (SSR, tests), so the result is not worth surfacing.
	let select_all = move |_: FocusEvent| {
		let _ = document::eval("document.activeElement?.select?.();");
	};
	let toggle = move |_| {
		// Reopening lands on the value's month, not wherever the grid was left.
		if !open.get()
			&& let Some(v) = value
		{
			month.set(v.date);
		}
		open.set(!open.get());
	};

	let label = match (value, format) {
		(Some(v), Some(f)) => f.call(v),
		(Some(v), None) => v.label(),
		(None, _) => placeholder,
	};
	let is_empty = value.is_none();
	let trigger_class = button_classes(&ButtonVariant::Outline, Size::Md, false, &cn!(DATE_TIME_PICKER_TRIGGER, class));
	let content_class = cn!(POPOVER_CONTENT, cn!("absolute top-full left-0 mt-1", DATE_TIME_PICKER_CONTENT));
	let time_input_class = cn!(INPUT_BASE, DATE_TIME_PICKER_TIME_INPUT);
	let clear_class = button_classes(&ButtonVariant::Ghost, Size::Sm, false, DATE_TIME_PICKER_CLEAR);
	let (hours, minutes) = value.map_or_else(|| (String::from("00"), String::from("00")), |v| (format!("{:02}", v.hour), format!("{:02}", v.minute)));
	let hours_label = labels.hours.unwrap_or_else(|| String::from("Hours"));
	let minutes_label = labels.minutes.unwrap_or_else(|| String::from("Minutes"));
	let clear_label = labels.clear.unwrap_or_else(|| String::from("Clear"));
	let dialog_label = labels.dialog.unwrap_or_else(|| String::from("Choose date and time"));

	rsx! {
		div {
			class: "relative",
			"data-slot": "date-time-picker",
			onkeydown: move |e| {
				if e.key() == Key::Escape {
					open.set(false);
				}
			},
			button {
				r#type: "button",
				id,
				class: trigger_class,
				"data-slot": "date-time-picker-trigger",
				"data-placeholder": if is_empty { Some("true") } else { None },
				"aria-haspopup": "dialog",
				"aria-expanded": if is_open { "true" } else { "false" },
				disabled,
				onclick: toggle,
				CalendarIcon {}
				span { {label} }
			}
			if let Some(name) = name {
				input {
					r#type: "hidden",
					name,
					value: value.map(|v| v.form_value()).unwrap_or_default(),
				}
			}
			if is_open {
				div {
					class: "fixed inset-0 z-40",
					onclick: move |_| open.set(false),
				}
				div {
					class: content_class,
					role: "dialog",
					"aria-label": dialog_label,
					"data-slot": "date-time-picker-content",
					"data-state": "open",
					"data-side": "bottom",
					"data-align": "start",
					Calendar {
						selected: value.map(|v| v.date),
						on_select,
						month: month(),
						on_month_change: move |m| month.set(m),
						today,
						min: min.map(|m| m.date),
						max: max.map(|m| m.date),
						previous_month_label: labels.previous_month,
						next_month_label: labels.next_month,
					}
					div { class: DATE_TIME_PICKER_TIME, "data-slot": "date-time-picker-time",
						input {
							r#type: "text",
							inputmode: "numeric",
							class: time_input_class.clone(),
							"data-slot": "date-time-picker-hours",
							"aria-label": hours_label,
							value: hours,
							disabled,
							oninput: on_hours,
							onfocus: select_all,
						}
						span {
							class: DATE_TIME_PICKER_TIME_SEPARATOR,
							"aria-hidden": "true",
							":"
						}
						input {
							r#type: "text",
							inputmode: "numeric",
							class: time_input_class,
							"data-slot": "date-time-picker-minutes",
							"aria-label": minutes_label,
							value: minutes,
							disabled,
							oninput: on_minutes,
							onfocus: select_all,
						}
						button {
							r#type: "button",
							class: clear_class,
							"data-slot": "date-time-picker-clear",
							disabled,
							onclick: on_clear,
							{clear_label}
						}
					}
				}
			}
		}
	}
}
/// Parses the digits an operator typed into an hours/minutes field. `None`
/// (nothing typed, or no digit at all) keeps the last value.
///
/// The LAST two digits win: the field is controlled, so what the browser hands
/// over is the old value plus the keystroke ("01" + "5" = "015"), and the
/// freshest digits are the ones the operator meant.
fn parse_field(raw: &str, max: u32) -> Option<u32> {
	let digits: Vec<char> = raw.chars().filter(char::is_ascii_digit).collect();
	if digits.is_empty() {
		return None;
	}
	let tail = String::from_iter(&digits[digits.len().saturating_sub(2)..]);
	// Two ASCII digits always parse; the `unwrap_or` is for the type, not a path.
	Some(tail.parse::<u32>().unwrap_or(0).min(max))
}

#[component]
fn CalendarIcon() -> Element {
	rsx! {
		svg {
			class: "size-4",
			xmlns: "http://www.w3.org/2000/svg",
			width: "24",
			height: "24",
			view_box: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			stroke_width: "2",
			stroke_linecap: "round",
			stroke_linejoin: "round",
			"aria-hidden": "true",
			for d in CALENDAR_ICON {
				path { d }
			}
		}
	}
}

#[cfg(test)]
mod tests {
	use dioxus::dioxus_core::{AttributeValue, Mutation};

	use super::*;
	use crate::uikit::test_util::{mutations_after_input, render};

	fn june(day: u32, hour: u32, minute: u32) -> LocalDateTime {
		LocalDateTime::new(CalendarDate::new(2026, 6, day), hour, minute)
	}

	#[test]
	fn local_date_time_orders_and_clamps_at_minute_precision() {
		assert!(june(10, 9, 30) < june(10, 9, 31));
		assert!(june(10, 23, 59) < june(11, 0, 0));
		let lo = june(10, 9, 0);
		let hi = june(20, 18, 0);
		assert_eq!(june(10, 8, 59).clamp_to(Some(lo), Some(hi)), lo);
		assert_eq!(june(20, 18, 1).clamp_to(Some(lo), Some(hi)), hi);
		assert_eq!(june(15, 12, 0).clamp_to(Some(lo), Some(hi)), june(15, 12, 0));
		assert_eq!(june(1, 0, 0).clamp_to(None, None), june(1, 0, 0));
	}

	#[test]
	fn parse_field_clamps_and_keeps_last_on_empty() {
		assert_eq!(parse_field("7", 23), Some(7));
		assert_eq!(parse_field("09", 23), Some(9));
		assert_eq!(parse_field("31", 23), Some(23));
		assert_eq!(parse_field("75", 59), Some(59));
		// Sequential typing over a controlled field: "0" + "1", then "01" + "5".
		assert_eq!(parse_field("01", 23), Some(1));
		assert_eq!(parse_field("015", 23), Some(15));
		assert_eq!(parse_field("123", 59), Some(23));
		assert_eq!(parse_field("1a5", 59), Some(15));
		assert_eq!(parse_field("", 23), None);
		assert_eq!(parse_field("ab", 23), None);
	}

	#[test]
	fn closed_by_default_shows_placeholder_trigger_only() {
		fn app() -> Element {
			rsx! {
				DateTimePicker { placeholder: "Pick a moment", name: "starts_at" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"date-time-picker\""), "{html}");
		assert!(html.contains("data-slot=\"date-time-picker-trigger\""), "{html}");
		assert!(html.contains("data-placeholder=\"true\""), "{html}");
		assert!(html.contains("aria-haspopup=\"dialog\""), "{html}");
		assert!(html.contains("aria-expanded=\"false\""), "{html}");
		assert!(html.contains("Pick a moment"), "{html}");
		assert!(html.contains("type=\"hidden\""), "{html}");
		assert!(html.contains("name=\"starts_at\""), "{html}");
		assert!(html.contains("value=\"\""), "{html}");
		assert!(!html.contains("data-slot=\"calendar\""), "closed: {html}");
		assert!(!html.contains("date-time-picker-hours"), "closed: {html}");
	}

	#[test]
	fn default_open_renders_calendar_and_zero_padded_time() {
		fn app() -> Element {
			rsx! {
				DateTimePicker { default_open: true, value: june(10, 9, 5), name: "starts_at" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"date-time-picker-content\""), "{html}");
		assert!(html.contains("aria-label=\"Choose date and time\""), "{html}");
		assert!(html.contains("data-slot=\"calendar\""), "{html}");
		assert!(html.contains("June 2026"), "{html}");
		assert!(html.contains("data-selected=\"true\""), "{html}");
		assert!(html.contains("data-slot=\"date-time-picker-hours\""), "{html}");
		assert!(html.contains("data-slot=\"date-time-picker-minutes\""), "{html}");
		assert!(html.contains("value=\"09\""), "{html}");
		assert!(html.contains("value=\"05\""), "{html}");
		assert!(html.contains("aria-label=\"Hours\""), "{html}");
		assert!(html.contains("aria-label=\"Minutes\""), "{html}");
		assert!(html.contains("inputmode=\"numeric\""), "{html}");
		assert!(html.contains("data-slot=\"date-time-picker-clear\""), "{html}");
		assert!(html.contains(">Clear<"), "{html}");
		assert!(html.contains("2026-06-10 09:05"), "{html}");
		assert!(html.contains("value=\"2026-06-10T09:05\""), "{html}");
		assert!(html.contains("aria-expanded=\"true\""), "{html}");
		assert!(!html.contains("data-placeholder"), "{html}");
	}

	#[test]
	fn format_callback_drives_the_label() {
		fn app() -> Element {
			rsx! {
				DateTimePicker {
					value: june(10, 9, 5),
					format: |v: LocalDateTime| format!("{}/{} at {}h", v.date.day, v.date.month, v.hour),
				}
			}
		}
		let html = render(app);
		assert!(html.contains("10/6 at 9h"), "{html}");
		assert!(!html.contains("2026-06-10 09:05"), "{html}");
	}

	#[test]
	fn days_outside_min_max_render_disabled() {
		fn app() -> Element {
			rsx! {
				DateTimePicker {
					default_open: true,
					value: june(15, 12, 0),
					min: june(10, 9, 0),
					max: june(20, 18, 0),
				}
			}
		}
		let html = render(app);
		assert_eq!(html.matches("data-disabled=\"true\"").count(), 19, "{html}");
	}

	#[test]
	fn labels_and_disabled_reach_the_markup() {
		fn app() -> Element {
			rsx! {
				DateTimePicker {
					default_open: true,
					disabled: true,
					labels: DateTimePickerLabels {
						previous_month: Some("Назад".into()),
						next_month: Some("Вперёд".into()),
						hours: Some("Часы".into()),
						minutes: Some("Минуты".into()),
						clear: Some("Сбросить".into()),
						dialog: Some("Выберите дату и время".into()),
					},
				}
			}
		}
		let html = render(app);
		assert!(html.contains("aria-label=\"Назад\""), "{html}");
		assert!(html.contains("aria-label=\"Вперёд\""), "{html}");
		assert!(html.contains("aria-label=\"Часы\""), "{html}");
		assert!(html.contains("aria-label=\"Минуты\""), "{html}");
		assert!(html.contains(">Сбросить<"), "{html}");
		assert!(html.contains("aria-label=\"Выберите дату и время\""), "{html}");
		assert!(!html.contains("Choose date and time"), "{html}");
		assert!(html.contains("disabled=true"), "{html}");
		// Trigger, both time fields and Clear.
		assert_eq!(html.matches(" disabled=true").count(), 4, "{html}");
		// Empty value: the time inputs show midnight.
		assert_eq!(html.matches("value=\"00\"").count(), 2, "{html}");
	}

	/// The `value` strings a render wrote back to the DOM.
	fn written_values(mutations: &[Mutation]) -> Vec<String> {
		mutations
			.iter()
			.filter_map(|m| match m {
				Mutation::SetAttribute {
					name: "value",
					value: AttributeValue::Text(v),
					..
				} => Some(v.clone()),
				_ => None,
			})
			.collect()
	}

	fn open_at_nine_oh_five() -> Element {
		rsx! {
			DateTimePicker { default_open: true, value: june(10, 9, 5) }
		}
	}

	#[test]
	fn typing_the_same_hour_writes_the_padded_value_back() {
		// "9" over a selected "09" emits the unchanged value, so no prop moves;
		// the field must still be patched back from the raw "9" to "09".
		let written = written_values(&mutations_after_input(open_at_nine_oh_five, "9"));
		assert!(written.contains(&String::from("09")), "{written:?}");
		assert!(written.contains(&String::from("05")), "{written:?}");
	}

	#[test]
	fn emptying_a_field_writes_the_last_value_back() {
		// Backspace to "": nothing parses, nothing is emitted — the field snaps
		// back to the value it shows in the trigger label instead of staying blank.
		let written = written_values(&mutations_after_input(open_at_nine_oh_five, ""));
		assert!(written.contains(&String::from("09")), "{written:?}");
		assert!(written.contains(&String::from("05")), "{written:?}");
	}

	#[test]
	fn empty_value_opens_on_the_bound_month_before_today() {
		fn app() -> Element {
			rsx! {
				DateTimePicker {
					default_open: true,
					today: CalendarDate::new(2026, 6, 15),
					min: LocalDateTime::new(CalendarDate::new(2026, 8, 1), 0, 0),
				}
			}
		}
		let html = render(app);
		assert!(html.contains("August 2026"), "{html}");
		assert!(!html.contains("June 2026"), "{html}");
	}
}
