use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		button::{ButtonSize, ButtonVariant, button_classes},
		primitives::use_controllable,
	},
};

const MONTHS: [&str; 12] = [
	"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS: [&str; 7] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const CHEVRON_LEFT: &str = "m15 18-6-6 6-6";
const CHEVRON_RIGHT: &str = "m9 18 6-6-6-6";
/// A calendar date as plain `(year, month 1-12, day 1-31)`. The kernel does its
/// own date math (no `chrono`/`jiff`): `wasm32`-safe and dependency-free.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CalendarDate {
	pub year: i32,
	pub month: u32,
	pub day: u32,
}

impl CalendarDate {
	pub fn new(year: i32, month: u32, day: u32) -> Self {
		Self { year, month, day }
	}

	fn is_leap(year: i32) -> bool {
		(year % 4 == 0 && year % 100 != 0) || year % 400 == 0
	}

	/// Days in `month` (1-12) of `year`, accounting for leap February.
	fn days_in_month(year: i32, month: u32) -> u32 {
		match month {
			1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
			4 | 6 | 9 | 11 => 30,
			2 if Self::is_leap(year) => 29,
			2 => 28,
			_ => 30,
		}
	}

	/// Weekday of the first day of the month, **Monday = 0 … Sunday = 6**, via
	/// Zeller's congruence (week starts Monday).
	fn first_weekday_monday0(year: i32, month: u32) -> u32 {
		// Zeller treats Jan/Feb as months 13/14 of the previous year.
		let (m, y) = if month < 3 { (month + 12, year - 1) } else { (month, year) };
		let k = y.rem_euclid(100);
		let j = y.div_euclid(100);
		let q = 1i32; // first of the month
		// h: 0 = Saturday, 1 = Sunday, 2 = Monday, …, 6 = Friday.
		let h = (q + (13 * (m as i32 + 1)) / 5 + k + k / 4 + j / 4 + 5 * j).rem_euclid(7);
		// Map Saturday-based h to Monday-based 0..=6.
		((h + 5).rem_euclid(7)) as u32
	}

	/// Same month + day shifted by `delta` months, clamped to the target
	/// month's length (used by the prev/next nav).
	fn add_months(&self, delta: i32) -> Self {
		let zero = (self.year as i64) * 12 + (self.month as i64 - 1) + delta as i64;
		let year = zero.div_euclid(12) as i32;
		let month = (zero.rem_euclid(12) + 1) as u32;
		let day = self.day.min(Self::days_in_month(year, month));
		Self { year, month, day }
	}
}

// Week starts Monday.

/// A dep-light single-month, single-date picker. Mirrors the landing
/// `Calendar`'s class names while replacing `react-day-picker` with hand-rolled
/// month-grid math.
///
/// Simplifications versus the source: one month only (no multi-month), a single
/// selected date (no range/multi), and none of the locale/dropdown/caption
/// features — see the package README.
#[component]
pub fn Calendar(
	/// The currently selected day, if any.
	selected: Option<CalendarDate>,
	/// Fired with the day a user activates.
	on_select: Option<EventHandler<CalendarDate>>,
	/// Controlled displayed month (any day in it is fine).
	month: Option<CalendarDate>,
	/// Uncontrolled initial displayed month.
	#[props(default = CalendarDate::new(2026, 6, 1))]
	default_month: CalendarDate,
	/// Fired when the displayed month changes via the nav buttons.
	on_month_change: Option<EventHandler<CalendarDate>>,
	/// "Today", highlighted in the grid.
	today: Option<CalendarDate>,
	#[props(default)] class: String,
) -> Element {
	let view = use_controllable(month, default_month, on_month_change);
	let current = view.get();

	let go = move |delta: i32| {
		view.set(current.add_months(delta));
	};

	let nav_class = button_classes(&ButtonVariant::Ghost, &ButtonSize::Icon, "size-8 p-0 select-none");
	let caption = format!("{} {}", MONTHS[(current.month - 1) as usize], current.year);

	let lead = CalendarDate::first_weekday_monday0(current.year, current.month);
	let total = CalendarDate::days_in_month(current.year, current.month);
	// Pad leading blanks then the days, padded out to whole weeks of 7.
	let mut cells: Vec<Option<u32>> = (0..lead).map(|_| None).collect();
	cells.extend((1..=total).map(Some));
	while !cells.len().is_multiple_of(7) {
		cells.push(None);
	}
	let weeks: Vec<Vec<Option<u32>>> = cells.chunks(7).map(<[Option<u32>]>::to_vec).collect();

	let root = cn!("bg-background p-3 w-fit", class);

	rsx! {
		div { class: root, "data-slot": "calendar", role: "application",
			div { class: "flex items-center justify-between gap-1 w-full px-1",
				button {
					r#type: "button",
					class: nav_class.clone(),
					"aria-label": "Previous month",
					onclick: move |_| go(-1),
					Chevron { d: CHEVRON_LEFT }
				}
				div { class: "text-sm font-medium select-none", {caption} }
				button {
					r#type: "button",
					class: nav_class.clone(),
					"aria-label": "Next month",
					onclick: move |_| go(1),
					Chevron { d: CHEVRON_RIGHT }
				}
			}
			table { class: "w-full border-collapse mt-4", role: "grid",
				thead {
					tr { class: "flex",
						for wd in WEEKDAYS {
							th {
								class: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] select-none",
								scope: "col",
								{wd}
							}
						}
					}
				}
				tbody {
					for week in weeks {
						tr { class: "flex w-full mt-2",
							for cell in week {
								DayCell {
									cell,
									date: current,
									selected,
									today,
									on_select,
								}
							}
						}
					}
				}
			}
		}
	}
}

#[component]
fn DayCell(cell: Option<u32>, date: CalendarDate, selected: Option<CalendarDate>, today: Option<CalendarDate>, on_select: Option<EventHandler<CalendarDate>>) -> Element {
	let Some(day) = cell else {
		return rsx! {
			td { class: "relative w-full h-full p-0 aspect-square select-none" }
		};
	};

	let this = CalendarDate::new(date.year, date.month, day);
	let is_selected = selected == Some(this);
	let is_today = today == Some(this);
	let aria_selected = if is_selected { "true" } else { "false" };

	let mut day_class = button_classes(&ButtonVariant::Ghost, &ButtonSize::Icon, "size-auto w-full aspect-square font-normal leading-none");
	if is_selected {
		day_class = cn!(day_class, "bg-primary text-primary-foreground");
	} else if is_today {
		day_class = cn!(day_class, "bg-accent text-accent-foreground rounded-md");
	}

	rsx! {
		td {
			class: "relative w-full h-full p-0 text-center aspect-square select-none",
			role: "gridcell",
			"aria-selected": aria_selected,
			button {
				r#type: "button",
				class: day_class,
				"data-slot": "calendar-day",
				"data-selected": if is_selected { "true" } else { "false" },
				"data-today": if is_today { "true" } else { "false" },
				onclick: move |_| {
					if let Some(h) = on_select {
						h.call(this);
					}
				},
				"{day}"
			}
		}
	}
}

#[component]
fn Chevron(d: &'static str) -> Element {
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
			path { d }
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn days_in_month_handles_leap_february() {
		assert_eq!(CalendarDate::days_in_month(2024, 2), 29);
		assert_eq!(CalendarDate::days_in_month(2023, 2), 28);
		assert_eq!(CalendarDate::days_in_month(1900, 2), 28);
		assert_eq!(CalendarDate::days_in_month(2000, 2), 29);
		assert_eq!(CalendarDate::days_in_month(2026, 4), 30);
		assert_eq!(CalendarDate::days_in_month(2026, 1), 31);
	}

	#[test]
	fn first_weekday_is_monday_zero() {
		// 1 June 2026 is a Monday.
		assert_eq!(CalendarDate::first_weekday_monday0(2026, 6), 0);
		// 1 Jan 2026 is a Thursday.
		assert_eq!(CalendarDate::first_weekday_monday0(2026, 1), 3);
		// 1 Feb 2026 is a Sunday.
		assert_eq!(CalendarDate::first_weekday_monday0(2026, 2), 6);
	}

	#[test]
	fn add_months_wraps_year_and_clamps_day() {
		let dec = CalendarDate::new(2026, 12, 15);
		assert_eq!(dec.add_months(1), CalendarDate::new(2027, 1, 15));
		let jan = CalendarDate::new(2026, 1, 10);
		assert_eq!(jan.add_months(-1), CalendarDate::new(2025, 12, 10));
		// 31 Jan + 1 month clamps to 28 Feb (non-leap).
		let jan31 = CalendarDate::new(2026, 1, 31);
		assert_eq!(jan31.add_months(1), CalendarDate::new(2026, 2, 28));
	}

	#[test]
	fn renders_month_grid_with_slots_and_weekdays() {
		fn app() -> Element {
			rsx! {
				Calendar { default_month: CalendarDate::new(2026, 6, 1) }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"calendar\""), "{html}");
		assert!(html.contains("June 2026"), "{html}");
		assert!(html.contains("Mo"));
		assert!(html.contains("role=\"gridcell\""), "{html}");
		// Every day of June is present.
		assert!(html.contains(">30<"), "{html}");
	}

	#[test]
	fn selected_and_today_get_their_classes() {
		fn app() -> Element {
			rsx! {
				Calendar {
					default_month: CalendarDate::new(2026, 6, 1),
					selected: CalendarDate::new(2026, 6, 10),
					today: CalendarDate::new(2026, 6, 15),
				}
			}
		}
		let html = render(app);
		assert!(html.contains("aria-selected=\"true\""), "{html}");
		assert!(html.contains("bg-primary"), "{html}");
		assert!(html.contains("bg-accent"), "{html}");
		assert!(html.contains("data-selected=\"true\""), "{html}");
	}
}
