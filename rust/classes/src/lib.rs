//! Pure styling data for the uikit: Tailwind class tables, variant/size enums and
//! the `cn!` fuse macro. Carries no Dioxus — it's the single source of truth that
//! both the Rust components (`ev_lib`) and the TS codegen (`ev_lib_gen`) read from.

mod accordion;
mod alert;
mod alert_dialog;
mod avatar;
mod badge;
mod breadcrumb;
mod button;
mod button_group;
mod calendar;
mod card;
mod carousel;
mod chart;
mod command;
mod container;
mod context_menu;
mod dialog;
mod drawer;
mod dropdown_menu;
mod empty;
mod field;
mod form;
mod hover_card;
mod input;
mod input_group;
mod input_otp;
mod item;
mod kbd;
mod label;
mod menubar;
mod navigation_menu;
mod popover;
mod progress;
mod radio_group;
mod resizable;
mod scroll_area;
mod separator;
mod sheet;
mod sidebar;
mod size;
mod skeleton;
mod slider;
mod sonner;
mod table;
mod tabs;
mod textarea;
mod toggle;
mod tooltip;

pub use accordion::{ACCORDION_CONTENT, ACCORDION_CONTENT_INNER, ACCORDION_HEADER, ACCORDION_ITEM, ACCORDION_TRIGGER};
pub use alert::{ALERT_BASE, ALERT_DESCRIPTION, ALERT_TITLE, AlertVariant};
pub use alert_dialog::{ALERT_DIALOG_CONTENT, ALERT_DIALOG_DESCRIPTION, ALERT_DIALOG_FOOTER, ALERT_DIALOG_HEADER, ALERT_DIALOG_OVERLAY, ALERT_DIALOG_TITLE};
pub use avatar::{AVATAR, AVATAR_FALLBACK, AVATAR_IMAGE};
pub use badge::{BADGE_BASE, BadgeVariant};
pub use breadcrumb::{BREADCRUMB_ELLIPSIS, BREADCRUMB_ITEM, BREADCRUMB_LINK, BREADCRUMB_LIST, BREADCRUMB_PAGE, BREADCRUMB_SEPARATOR};
pub use button::{BUTTON_BASE, ButtonVariant, button_size_class};
pub use button_group::{BUTTON_GROUP_BASE, BUTTON_GROUP_SEPARATOR_BASE, BUTTON_GROUP_TEXT_BASE, ButtonGroupOrientation};
pub use calendar::{
	CALENDAR_CAPTION, CALENDAR_DAY, CALENDAR_DAY_CELL, CALENDAR_DAY_EMPTY, CALENDAR_DAY_SELECTED, CALENDAR_DAY_TODAY, CALENDAR_GRID, CALENDAR_NAV, CALENDAR_NAV_BUTTON, CALENDAR_ROOT,
	CALENDAR_WEEK, CALENDAR_WEEKDAY, CALENDAR_WEEKDAY_ROW,
};
pub use card::{CARD, CARD_ACTION, CARD_CONTENT, CARD_DESCRIPTION, CARD_FOOTER, CARD_HEADER, CARD_TITLE};
pub use carousel::{
	CAROUSEL_CONTENT_TRACK, CAROUSEL_CONTENT_TRACK_HORIZONTAL, CAROUSEL_CONTENT_TRACK_VERTICAL, CAROUSEL_CONTENT_VIEWPORT, CAROUSEL_EDGE_FADE_NEXT, CAROUSEL_EDGE_FADE_PREV, CAROUSEL_ITEM,
	CAROUSEL_ITEM_HORIZONTAL, CAROUSEL_ITEM_VERTICAL, CAROUSEL_NAV, CAROUSEL_NEXT_HORIZONTAL, CAROUSEL_NEXT_VERTICAL, CAROUSEL_PREVIOUS_HORIZONTAL, CAROUSEL_PREVIOUS_VERTICAL,
};
pub use chart::{CHART_CONTAINER, CHART_LEGEND, CHART_TOOLTIP};
pub use command::{
	COMMAND_DIALOG_COMMAND, COMMAND_DIALOG_CONTENT, COMMAND_DIALOG_OVERLAY, COMMAND_EMPTY, COMMAND_GROUP, COMMAND_INPUT, COMMAND_INPUT_WRAPPER, COMMAND_ITEM, COMMAND_LIST, COMMAND_ROOT,
	COMMAND_SEPARATOR, COMMAND_SHORTCUT,
};
pub use container::CONTAINER_BASE;
pub use context_menu::{
	CONTEXT_MENU_CHECK_ITEM, CONTEXT_MENU_CONTENT, CONTEXT_MENU_ITEM, CONTEXT_MENU_LABEL, CONTEXT_MENU_SEPARATOR, CONTEXT_MENU_SHORTCUT, CONTEXT_MENU_SUB_CONTENT, CONTEXT_MENU_SUB_TRIGGER,
};
pub use dialog::{DIALOG_CLOSE, DIALOG_CONTENT, DIALOG_DESCRIPTION, DIALOG_FOOTER, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_TITLE};
pub use drawer::{DRAWER_CONTENT_BASE, DRAWER_DESCRIPTION, DRAWER_FOOTER, DRAWER_HANDLE, DRAWER_HEADER, DRAWER_OVERLAY, DRAWER_TITLE, DrawerDirection};
pub use dropdown_menu::{
	DROPDOWN_MENU_CHECK_ITEM, DROPDOWN_MENU_CONTENT, DROPDOWN_MENU_ITEM, DROPDOWN_MENU_ITEM_INDICATOR, DROPDOWN_MENU_LABEL, DROPDOWN_MENU_SEPARATOR, DROPDOWN_MENU_SHORTCUT,
	DROPDOWN_MENU_SUB_CONTENT, DROPDOWN_MENU_SUB_TRIGGER,
};
pub use empty::{EMPTY, EMPTY_CONTENT, EMPTY_DESCRIPTION, EMPTY_HEADER, EMPTY_MEDIA_BASE, EMPTY_TITLE, EmptyMediaVariant};
pub use field::{
	FIELD_BASE, FIELD_CONTENT, FIELD_DESCRIPTION, FIELD_ERROR, FIELD_GROUP, FIELD_LABEL, FIELD_LEGEND, FIELD_SEPARATOR, FIELD_SEPARATOR_CONTENT, FIELD_SEPARATOR_LINE, FIELD_SET,
	FIELD_TITLE, FieldOrientation,
};
pub use form::{FORM_DESCRIPTION, FORM_ITEM, FORM_LABEL, FORM_MESSAGE};
pub use hover_card::HOVER_CARD_CONTENT;
pub use input::INPUT_BASE;
pub use input_group::{
	INPUT_GROUP_ADDON_BASE, INPUT_GROUP_BASE, INPUT_GROUP_BUTTON_BASE, INPUT_GROUP_INPUT_CONTROL, INPUT_GROUP_TEXT, INPUT_GROUP_TEXTAREA_CONTROL, InputGroupAddonAlign, InputGroupButtonSize,
	input_group_button_size_class,
};
pub use input_otp::{INPUT_OTP_CONTAINER, INPUT_OTP_GROUP, INPUT_OTP_INPUT, INPUT_OTP_SLOT, INPUT_OTP_SLOT_CARET, INPUT_OTP_SLOT_CARET_WRAPPER};
pub use item::{
	ITEM_ACTIONS, ITEM_BASE, ITEM_CONTENT, ITEM_DESCRIPTION, ITEM_FOOTER, ITEM_GROUP, ITEM_HEADER, ITEM_MEDIA_BASE, ITEM_SEPARATOR, ITEM_TITLE, ItemMediaVariant, ItemSize, ItemVariant,
};
pub use kbd::{KBD_BASE, KBD_GROUP_BASE};
pub use label::LABEL_BASE;
pub use menubar::{
	MENUBAR_CHECKBOX_ITEM, MENUBAR_CONTENT, MENUBAR_ITEM, MENUBAR_ITEM_INDICATOR, MENUBAR_LABEL, MENUBAR_RADIO_ITEM, MENUBAR_ROOT, MENUBAR_SEPARATOR, MENUBAR_SHORTCUT, MENUBAR_SUB_CONTENT,
	MENUBAR_SUB_TRIGGER, MENUBAR_TRIGGER,
};
pub use navigation_menu::{
	NAVIGATION_MENU, NAVIGATION_MENU_CONTENT, NAVIGATION_MENU_INDICATOR, NAVIGATION_MENU_ITEM, NAVIGATION_MENU_LINK, NAVIGATION_MENU_LIST, NAVIGATION_MENU_TRIGGER_STYLE,
	NAVIGATION_MENU_VIEWPORT,
};
pub use popover::POPOVER_CONTENT;
pub use progress::{PROGRESS_INDICATOR, PROGRESS_TRACK};
pub use radio_group::{RADIO_GROUP_ITEM, RADIO_GROUP_ROOT};
pub use resizable::{RESIZABLE_GROUP, RESIZABLE_HANDLE, RESIZABLE_HANDLE_GRIP, RESIZABLE_PANEL};
pub use scroll_area::{SCROLL_AREA_THUMB, SCROLL_AREA_VIEWPORT, SCROLLBAR_BASE, ScrollBarOrientation};
pub use separator::{Orientation, SEPARATOR_BASE};
pub use sheet::{
	SHEET_CLOSE, SHEET_CONTENT, SHEET_DESCRIPTION, SHEET_FOOTER, SHEET_HEADER, SHEET_OVERLAY, SHEET_SIDE_BOTTOM, SHEET_SIDE_LEFT, SHEET_SIDE_RIGHT, SHEET_SIDE_TOP, SHEET_TITLE,
};
pub use sidebar::{
	SIDEBAR_CONTENT, SIDEBAR_FLAT, SIDEBAR_FOOTER, SIDEBAR_GROUP, SIDEBAR_GROUP_CONTENT, SIDEBAR_GROUP_LABEL, SIDEBAR_HEADER, SIDEBAR_INNER, SIDEBAR_INSET, SIDEBAR_MENU,
	SIDEBAR_MENU_BUTTON_BASE, SIDEBAR_MENU_ITEM, SIDEBAR_RAIL, SIDEBAR_SEPARATOR, SIDEBAR_TRIGGER, SIDEBAR_WRAPPER, SidebarMenuButtonSize, SidebarMenuButtonVariant,
};
pub use size::Size;
pub use skeleton::SKELETON_BASE;
pub use slider::{SLIDER_RANGE, SLIDER_ROOT, SLIDER_THUMB, SLIDER_TRACK};
pub use sonner::{TOAST_BASE, TOAST_CLOSE, TOAST_CONTENT, TOAST_TITLE, TOASTER_BASE, ToastPosition, ToastVariant};
pub use table::{TABLE, TABLE_BODY, TABLE_CAPTION, TABLE_CELL, TABLE_CONTAINER, TABLE_FOOTER, TABLE_HEAD, TABLE_HEADER, TABLE_ROW};
pub use tabs::{TABS_CONTENT, TABS_LIST, TABS_ROOT, TABS_TRIGGER};
pub use textarea::TEXTAREA_BASE;
pub use toggle::{TOGGLE_BASE, ToggleVariant, toggle_size_class};
pub use tooltip::TOOLTIP_CONTENT;

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
