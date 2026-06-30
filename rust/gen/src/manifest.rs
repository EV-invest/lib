//! Flat per-component list of TS exports. Adding a class string is one line here;
//! the class values themselves live only in `ev_lib_classes`. Generic enum tables
//! use [`table`]; the few key-quirk tables are hand-built `Ts::Table` recipes.

use ev_lib_classes::*;
use tailwind_fuse::AsTailwindClass;

use crate::{Ts, table};

pub fn manifest() -> Vec<(&'static str, Vec<Ts>)> {
	vec![
		("button", button()),
		("alert", alert()),
		("toggle", toggle()),
		("badge", badge()),
		("separator", separator()),
		("button-group", button_group()),
		("empty", empty()),
		("scroll-area", scroll_area()),
		("input", input()),
		("label", label()),
		("skeleton", skeleton()),
		("textarea", textarea()),
		("kbd", kbd()),
		("container", container()),
		("card", card()),
		("breadcrumb", breadcrumb()),
		("avatar", avatar()),
		("alert-dialog", alert_dialog()),
		("sheet", sheet()),
		("popover", popover()),
		("tooltip", tooltip()),
		("dialog", dialog()),
		("command", command()),
		("table", data_table()),
		("form", form()),
		("navigation-menu", navigation_menu()),
		("hover-card", hover_card()),
		("progress", progress()),
		("radio-group", radio_group()),
		("input-otp", input_otp()),
		("chart", chart()),
		("calendar", calendar()),
		("drawer", drawer()),
		("slider", slider()),
		("tabs", tabs()),
		("carousel", carousel()),
		("accordion", accordion()),
		("resizable", resizable()),
		("dropdown-menu", dropdown_menu()),
		("context-menu", context_menu()),
		("menubar", menubar()),
		("sonner", sonner()),
		("field", field()),
		("input-group", input_group()),
		("item", item()),
		("sidebar", sidebar()),
	]
}

fn sidebar() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "SIDEBAR_MENU_BUTTON_BASE",
			value: SIDEBAR_MENU_BUTTON_BASE,
		},
		table::<SidebarMenuButtonVariant>("sidebarMenuButtonVariantClasses", "SidebarMenuButtonVariant"),
		table::<SidebarMenuButtonSize>("sidebarMenuButtonSizeClasses", "SidebarMenuButtonSize"),
		Ts::Const {
			name: "SIDEBAR_WRAPPER",
			value: SIDEBAR_WRAPPER,
		},
		Ts::Const {
			name: "SIDEBAR_FLAT",
			value: SIDEBAR_FLAT,
		},
		Ts::Const {
			name: "SIDEBAR_INNER",
			value: SIDEBAR_INNER,
		},
		Ts::Const {
			name: "SIDEBAR_TRIGGER",
			value: SIDEBAR_TRIGGER,
		},
		Ts::Const {
			name: "SIDEBAR_RAIL",
			value: SIDEBAR_RAIL,
		},
		Ts::Const {
			name: "SIDEBAR_INSET",
			value: SIDEBAR_INSET,
		},
		Ts::Const {
			name: "SIDEBAR_HEADER",
			value: SIDEBAR_HEADER,
		},
		Ts::Const {
			name: "SIDEBAR_FOOTER",
			value: SIDEBAR_FOOTER,
		},
		Ts::Const {
			name: "SIDEBAR_SEPARATOR",
			value: SIDEBAR_SEPARATOR,
		},
		Ts::Const {
			name: "SIDEBAR_CONTENT",
			value: SIDEBAR_CONTENT,
		},
		Ts::Const {
			name: "SIDEBAR_GROUP",
			value: SIDEBAR_GROUP,
		},
		Ts::Const {
			name: "SIDEBAR_GROUP_LABEL",
			value: SIDEBAR_GROUP_LABEL,
		},
		Ts::Const {
			name: "SIDEBAR_GROUP_CONTENT",
			value: SIDEBAR_GROUP_CONTENT,
		},
		Ts::Const {
			name: "SIDEBAR_MENU",
			value: SIDEBAR_MENU,
		},
		Ts::Const {
			name: "SIDEBAR_MENU_ITEM",
			value: SIDEBAR_MENU_ITEM,
		},
	]
}

fn item() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "ITEM_GROUP",
			value: ITEM_GROUP,
		},
		Ts::Const {
			name: "ITEM_SEPARATOR",
			value: ITEM_SEPARATOR,
		},
		Ts::Const {
			name: "ITEM_BASE",
			value: ITEM_BASE,
		},
		table::<ItemVariant>("itemVariants", "ItemVariant"),
		// Md → `default` key quirk (shared with button/toggle).
		Ts::Table {
			name: "itemSizes",
			ty: "ItemSize",
			entries: [(ItemSize::Md, "default"), (ItemSize::Sm, "sm")]
				.into_iter()
				.map(|(s, k)| (k.to_string(), s.as_class().to_string()))
				.collect(),
		},
		Ts::Const {
			name: "ITEM_MEDIA_BASE",
			value: ITEM_MEDIA_BASE,
		},
		table::<ItemMediaVariant>("itemMediaVariants", "ItemMediaVariant"),
		Ts::Const {
			name: "ITEM_CONTENT",
			value: ITEM_CONTENT,
		},
		Ts::Const {
			name: "ITEM_TITLE",
			value: ITEM_TITLE,
		},
		Ts::Const {
			name: "ITEM_DESCRIPTION",
			value: ITEM_DESCRIPTION,
		},
		Ts::Const {
			name: "ITEM_ACTIONS",
			value: ITEM_ACTIONS,
		},
		Ts::Const {
			name: "ITEM_HEADER",
			value: ITEM_HEADER,
		},
		Ts::Const {
			name: "ITEM_FOOTER",
			value: ITEM_FOOTER,
		},
	]
}

fn input_group() -> Vec<Ts> {
	use InputGroupButtonSize::{Sm, Xs};
	vec![
		Ts::Const {
			name: "INPUT_GROUP_BASE",
			value: INPUT_GROUP_BASE,
		},
		Ts::Const {
			name: "INPUT_GROUP_ADDON_BASE",
			value: INPUT_GROUP_ADDON_BASE,
		},
		table::<InputGroupAddonAlign>("inputGroupAddonAligns", "InputGroupAddonAlign"),
		Ts::Const {
			name: "INPUT_GROUP_BUTTON_BASE",
			value: INPUT_GROUP_BUTTON_BASE,
		},
		// Size × icon → shadcn's flat `xs`/`sm`/`icon-xs`/`icon-sm` keys.
		Ts::Table {
			name: "inputGroupButtonSizes",
			ty: "InputGroupButtonSize",
			entries: [(Xs, false, "xs"), (Sm, false, "sm"), (Xs, true, "icon-xs"), (Sm, true, "icon-sm")]
				.into_iter()
				.map(|(size, icon, key)| (key.to_string(), input_group_button_size_class(size, icon).to_string()))
				.collect(),
		},
		Ts::Const {
			name: "INPUT_GROUP_TEXT",
			value: INPUT_GROUP_TEXT,
		},
		Ts::Const {
			name: "INPUT_GROUP_INPUT_CONTROL",
			value: INPUT_GROUP_INPUT_CONTROL,
		},
		Ts::Const {
			name: "INPUT_GROUP_TEXTAREA_CONTROL",
			value: INPUT_GROUP_TEXTAREA_CONTROL,
		},
	]
}

fn field() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "FIELD_BASE",
			value: FIELD_BASE,
		},
		table::<FieldOrientation>("fieldOrientation", "FieldOrientation"),
		Ts::Const {
			name: "FIELD_SET",
			value: FIELD_SET,
		},
		Ts::Const {
			name: "FIELD_LEGEND",
			value: FIELD_LEGEND,
		},
		Ts::Const {
			name: "FIELD_GROUP",
			value: FIELD_GROUP,
		},
		Ts::Const {
			name: "FIELD_CONTENT",
			value: FIELD_CONTENT,
		},
		Ts::Const {
			name: "FIELD_LABEL",
			value: FIELD_LABEL,
		},
		Ts::Const {
			name: "FIELD_TITLE",
			value: FIELD_TITLE,
		},
		Ts::Const {
			name: "FIELD_DESCRIPTION",
			value: FIELD_DESCRIPTION,
		},
		Ts::Const {
			name: "FIELD_SEPARATOR",
			value: FIELD_SEPARATOR,
		},
		Ts::Const {
			name: "FIELD_SEPARATOR_LINE",
			value: FIELD_SEPARATOR_LINE,
		},
		Ts::Const {
			name: "FIELD_SEPARATOR_CONTENT",
			value: FIELD_SEPARATOR_CONTENT,
		},
		Ts::Const {
			name: "FIELD_ERROR",
			value: FIELD_ERROR,
		},
	]
}

fn sonner() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "TOAST_BASE",
			value: TOAST_BASE,
		},
		table::<ToastVariant>("toastVariantClasses", "ToastVariant"),
		Ts::Const {
			name: "TOASTER_BASE",
			value: TOASTER_BASE,
		},
		table::<ToastPosition>("positionClasses", "ToastPosition"),
		Ts::Const {
			name: "TOAST_CLOSE",
			value: TOAST_CLOSE,
		},
		Ts::Const {
			name: "TOAST_CONTENT",
			value: TOAST_CONTENT,
		},
		Ts::Const {
			name: "TOAST_TITLE",
			value: TOAST_TITLE,
		},
	]
}

fn dropdown_menu() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "DROPDOWN_MENU_CONTENT",
			value: DROPDOWN_MENU_CONTENT,
		},
		Ts::Const {
			name: "DROPDOWN_MENU_SUB_CONTENT",
			value: DROPDOWN_MENU_SUB_CONTENT,
		},
		Ts::Const {
			name: "DROPDOWN_MENU_ITEM",
			value: DROPDOWN_MENU_ITEM,
		},
		Ts::Const {
			name: "DROPDOWN_MENU_CHECK_ITEM",
			value: DROPDOWN_MENU_CHECK_ITEM,
		},
		Ts::Const {
			name: "DROPDOWN_MENU_SUB_TRIGGER",
			value: DROPDOWN_MENU_SUB_TRIGGER,
		},
		Ts::Const {
			name: "DROPDOWN_MENU_ITEM_INDICATOR",
			value: DROPDOWN_MENU_ITEM_INDICATOR,
		},
		Ts::Const {
			name: "DROPDOWN_MENU_LABEL",
			value: DROPDOWN_MENU_LABEL,
		},
		Ts::Const {
			name: "DROPDOWN_MENU_SEPARATOR",
			value: DROPDOWN_MENU_SEPARATOR,
		},
		Ts::Const {
			name: "DROPDOWN_MENU_SHORTCUT",
			value: DROPDOWN_MENU_SHORTCUT,
		},
	]
}

fn context_menu() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "CONTEXT_MENU_CONTENT",
			value: CONTEXT_MENU_CONTENT,
		},
		Ts::Const {
			name: "CONTEXT_MENU_SUB_CONTENT",
			value: CONTEXT_MENU_SUB_CONTENT,
		},
		Ts::Const {
			name: "CONTEXT_MENU_ITEM",
			value: CONTEXT_MENU_ITEM,
		},
		Ts::Const {
			name: "CONTEXT_MENU_CHECK_ITEM",
			value: CONTEXT_MENU_CHECK_ITEM,
		},
		Ts::Const {
			name: "CONTEXT_MENU_SUB_TRIGGER",
			value: CONTEXT_MENU_SUB_TRIGGER,
		},
		Ts::Const {
			name: "CONTEXT_MENU_LABEL",
			value: CONTEXT_MENU_LABEL,
		},
		Ts::Const {
			name: "CONTEXT_MENU_SEPARATOR",
			value: CONTEXT_MENU_SEPARATOR,
		},
		Ts::Const {
			name: "CONTEXT_MENU_SHORTCUT",
			value: CONTEXT_MENU_SHORTCUT,
		},
	]
}

fn menubar() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "MENUBAR_ROOT",
			value: MENUBAR_ROOT,
		},
		Ts::Const {
			name: "MENUBAR_TRIGGER",
			value: MENUBAR_TRIGGER,
		},
		Ts::Const {
			name: "MENUBAR_CONTENT",
			value: MENUBAR_CONTENT,
		},
		Ts::Const {
			name: "MENUBAR_ITEM",
			value: MENUBAR_ITEM,
		},
		Ts::Const {
			name: "MENUBAR_CHECKBOX_ITEM",
			value: MENUBAR_CHECKBOX_ITEM,
		},
		Ts::Const {
			name: "MENUBAR_RADIO_ITEM",
			value: MENUBAR_RADIO_ITEM,
		},
		Ts::Const {
			name: "MENUBAR_ITEM_INDICATOR",
			value: MENUBAR_ITEM_INDICATOR,
		},
		Ts::Const {
			name: "MENUBAR_LABEL",
			value: MENUBAR_LABEL,
		},
		Ts::Const {
			name: "MENUBAR_SEPARATOR",
			value: MENUBAR_SEPARATOR,
		},
		Ts::Const {
			name: "MENUBAR_SHORTCUT",
			value: MENUBAR_SHORTCUT,
		},
		Ts::Const {
			name: "MENUBAR_SUB_TRIGGER",
			value: MENUBAR_SUB_TRIGGER,
		},
		Ts::Const {
			name: "MENUBAR_SUB_CONTENT",
			value: MENUBAR_SUB_CONTENT,
		},
	]
}

fn slider() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "SLIDER_ROOT",
			value: SLIDER_ROOT,
		},
		Ts::Const {
			name: "SLIDER_TRACK",
			value: SLIDER_TRACK,
		},
		Ts::Const {
			name: "SLIDER_RANGE",
			value: SLIDER_RANGE,
		},
		Ts::Const {
			name: "SLIDER_THUMB",
			value: SLIDER_THUMB,
		},
	]
}

fn tabs() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "TABS_ROOT",
			value: TABS_ROOT,
		},
		Ts::Const {
			name: "TABS_LIST",
			value: TABS_LIST,
		},
		Ts::Const {
			name: "TABS_TRIGGER",
			value: TABS_TRIGGER,
		},
		Ts::Const {
			name: "TABS_CONTENT",
			value: TABS_CONTENT,
		},
	]
}

fn carousel() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "CAROUSEL_CONTENT_VIEWPORT",
			value: CAROUSEL_CONTENT_VIEWPORT,
		},
		Ts::Const {
			name: "CAROUSEL_CONTENT_TRACK",
			value: CAROUSEL_CONTENT_TRACK,
		},
		Ts::Const {
			name: "CAROUSEL_CONTENT_TRACK_HORIZONTAL",
			value: CAROUSEL_CONTENT_TRACK_HORIZONTAL,
		},
		Ts::Const {
			name: "CAROUSEL_CONTENT_TRACK_VERTICAL",
			value: CAROUSEL_CONTENT_TRACK_VERTICAL,
		},
		Ts::Const {
			name: "CAROUSEL_ITEM",
			value: CAROUSEL_ITEM,
		},
		Ts::Const {
			name: "CAROUSEL_ITEM_HORIZONTAL",
			value: CAROUSEL_ITEM_HORIZONTAL,
		},
		Ts::Const {
			name: "CAROUSEL_ITEM_VERTICAL",
			value: CAROUSEL_ITEM_VERTICAL,
		},
		Ts::Const {
			name: "CAROUSEL_NAV",
			value: CAROUSEL_NAV,
		},
		Ts::Const {
			name: "CAROUSEL_PREVIOUS_HORIZONTAL",
			value: CAROUSEL_PREVIOUS_HORIZONTAL,
		},
		Ts::Const {
			name: "CAROUSEL_PREVIOUS_VERTICAL",
			value: CAROUSEL_PREVIOUS_VERTICAL,
		},
		Ts::Const {
			name: "CAROUSEL_NEXT_HORIZONTAL",
			value: CAROUSEL_NEXT_HORIZONTAL,
		},
		Ts::Const {
			name: "CAROUSEL_NEXT_VERTICAL",
			value: CAROUSEL_NEXT_VERTICAL,
		},
		Ts::Const {
			name: "CAROUSEL_EDGE_FADE_PREV",
			value: CAROUSEL_EDGE_FADE_PREV,
		},
		Ts::Const {
			name: "CAROUSEL_EDGE_FADE_NEXT",
			value: CAROUSEL_EDGE_FADE_NEXT,
		},
	]
}

fn accordion() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "ACCORDION_ITEM",
			value: ACCORDION_ITEM,
		},
		Ts::Const {
			name: "ACCORDION_HEADER",
			value: ACCORDION_HEADER,
		},
		Ts::Const {
			name: "ACCORDION_TRIGGER",
			value: ACCORDION_TRIGGER,
		},
		Ts::Const {
			name: "ACCORDION_CONTENT",
			value: ACCORDION_CONTENT,
		},
		Ts::Const {
			name: "ACCORDION_CONTENT_INNER",
			value: ACCORDION_CONTENT_INNER,
		},
	]
}

fn resizable() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "RESIZABLE_GROUP",
			value: RESIZABLE_GROUP,
		},
		Ts::Const {
			name: "RESIZABLE_PANEL",
			value: RESIZABLE_PANEL,
		},
		Ts::Const {
			name: "RESIZABLE_HANDLE",
			value: RESIZABLE_HANDLE,
		},
		Ts::Const {
			name: "RESIZABLE_HANDLE_GRIP",
			value: RESIZABLE_HANDLE_GRIP,
		},
	]
}

fn drawer() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "DRAWER_CONTENT_BASE",
			value: DRAWER_CONTENT_BASE,
		},
		table::<DrawerDirection>("drawerDirectionClasses", "DrawerDirection"),
		Ts::Const {
			name: "DRAWER_OVERLAY",
			value: DRAWER_OVERLAY,
		},
		Ts::Const {
			name: "DRAWER_HANDLE",
			value: DRAWER_HANDLE,
		},
		Ts::Const {
			name: "DRAWER_HEADER",
			value: DRAWER_HEADER,
		},
		Ts::Const {
			name: "DRAWER_FOOTER",
			value: DRAWER_FOOTER,
		},
		Ts::Const {
			name: "DRAWER_TITLE",
			value: DRAWER_TITLE,
		},
		Ts::Const {
			name: "DRAWER_DESCRIPTION",
			value: DRAWER_DESCRIPTION,
		},
	]
}

fn input_otp() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "INPUT_OTP_CONTAINER",
			value: INPUT_OTP_CONTAINER,
		},
		Ts::Const {
			name: "INPUT_OTP_INPUT",
			value: INPUT_OTP_INPUT,
		},
		Ts::Const {
			name: "INPUT_OTP_GROUP",
			value: INPUT_OTP_GROUP,
		},
		Ts::Const {
			name: "INPUT_OTP_SLOT",
			value: INPUT_OTP_SLOT,
		},
		Ts::Const {
			name: "INPUT_OTP_SLOT_CARET_WRAPPER",
			value: INPUT_OTP_SLOT_CARET_WRAPPER,
		},
		Ts::Const {
			name: "INPUT_OTP_SLOT_CARET",
			value: INPUT_OTP_SLOT_CARET,
		},
	]
}

fn chart() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "CHART_CONTAINER",
			value: CHART_CONTAINER,
		},
		Ts::Const {
			name: "CHART_TOOLTIP",
			value: CHART_TOOLTIP,
		},
		Ts::Const {
			name: "CHART_LEGEND",
			value: CHART_LEGEND,
		},
	]
}

fn calendar() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "CALENDAR_ROOT",
			value: CALENDAR_ROOT,
		},
		Ts::Const {
			name: "CALENDAR_NAV_BUTTON",
			value: CALENDAR_NAV_BUTTON,
		},
		Ts::Const {
			name: "CALENDAR_NAV",
			value: CALENDAR_NAV,
		},
		Ts::Const {
			name: "CALENDAR_CAPTION",
			value: CALENDAR_CAPTION,
		},
		Ts::Const {
			name: "CALENDAR_GRID",
			value: CALENDAR_GRID,
		},
		Ts::Const {
			name: "CALENDAR_WEEKDAY_ROW",
			value: CALENDAR_WEEKDAY_ROW,
		},
		Ts::Const {
			name: "CALENDAR_WEEKDAY",
			value: CALENDAR_WEEKDAY,
		},
		Ts::Const {
			name: "CALENDAR_WEEK",
			value: CALENDAR_WEEK,
		},
		Ts::Const {
			name: "CALENDAR_DAY_EMPTY",
			value: CALENDAR_DAY_EMPTY,
		},
		Ts::Const {
			name: "CALENDAR_DAY_CELL",
			value: CALENDAR_DAY_CELL,
		},
		Ts::Const {
			name: "CALENDAR_DAY",
			value: CALENDAR_DAY,
		},
		Ts::Const {
			name: "CALENDAR_DAY_SELECTED",
			value: CALENDAR_DAY_SELECTED,
		},
		Ts::Const {
			name: "CALENDAR_DAY_TODAY",
			value: CALENDAR_DAY_TODAY,
		},
	]
}

fn dialog() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "DIALOG_OVERLAY",
			value: DIALOG_OVERLAY,
		},
		Ts::Const {
			name: "DIALOG_CONTENT",
			value: DIALOG_CONTENT,
		},
		Ts::Const {
			name: "DIALOG_CLOSE",
			value: DIALOG_CLOSE,
		},
		Ts::Const {
			name: "DIALOG_HEADER",
			value: DIALOG_HEADER,
		},
		Ts::Const {
			name: "DIALOG_FOOTER",
			value: DIALOG_FOOTER,
		},
		Ts::Const {
			name: "DIALOG_TITLE",
			value: DIALOG_TITLE,
		},
		Ts::Const {
			name: "DIALOG_DESCRIPTION",
			value: DIALOG_DESCRIPTION,
		},
	]
}

fn command() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "COMMAND_ROOT",
			value: COMMAND_ROOT,
		},
		Ts::Const {
			name: "COMMAND_DIALOG_OVERLAY",
			value: COMMAND_DIALOG_OVERLAY,
		},
		Ts::Const {
			name: "COMMAND_DIALOG_CONTENT",
			value: COMMAND_DIALOG_CONTENT,
		},
		Ts::Const {
			name: "COMMAND_DIALOG_COMMAND",
			value: COMMAND_DIALOG_COMMAND,
		},
		Ts::Const {
			name: "COMMAND_INPUT_WRAPPER",
			value: COMMAND_INPUT_WRAPPER,
		},
		Ts::Const {
			name: "COMMAND_INPUT",
			value: COMMAND_INPUT,
		},
		Ts::Const {
			name: "COMMAND_LIST",
			value: COMMAND_LIST,
		},
		Ts::Const {
			name: "COMMAND_EMPTY",
			value: COMMAND_EMPTY,
		},
		Ts::Const {
			name: "COMMAND_GROUP",
			value: COMMAND_GROUP,
		},
		Ts::Const {
			name: "COMMAND_ITEM",
			value: COMMAND_ITEM,
		},
		Ts::Const {
			name: "COMMAND_SEPARATOR",
			value: COMMAND_SEPARATOR,
		},
		Ts::Const {
			name: "COMMAND_SHORTCUT",
			value: COMMAND_SHORTCUT,
		},
	]
}

fn data_table() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "TABLE_CONTAINER",
			value: TABLE_CONTAINER,
		},
		Ts::Const { name: "TABLE", value: TABLE },
		Ts::Const {
			name: "TABLE_HEADER",
			value: TABLE_HEADER,
		},
		Ts::Const {
			name: "TABLE_BODY",
			value: TABLE_BODY,
		},
		Ts::Const {
			name: "TABLE_FOOTER",
			value: TABLE_FOOTER,
		},
		Ts::Const {
			name: "TABLE_ROW",
			value: TABLE_ROW,
		},
		Ts::Const {
			name: "TABLE_HEAD",
			value: TABLE_HEAD,
		},
		Ts::Const {
			name: "TABLE_CELL",
			value: TABLE_CELL,
		},
		Ts::Const {
			name: "TABLE_CAPTION",
			value: TABLE_CAPTION,
		},
	]
}

fn form() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "FORM_ITEM",
			value: FORM_ITEM,
		},
		Ts::Const {
			name: "FORM_LABEL",
			value: FORM_LABEL,
		},
		Ts::Const {
			name: "FORM_DESCRIPTION",
			value: FORM_DESCRIPTION,
		},
		Ts::Const {
			name: "FORM_MESSAGE",
			value: FORM_MESSAGE,
		},
	]
}

fn navigation_menu() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "NAVIGATION_MENU",
			value: NAVIGATION_MENU,
		},
		Ts::Const {
			name: "NAVIGATION_MENU_LIST",
			value: NAVIGATION_MENU_LIST,
		},
		Ts::Const {
			name: "NAVIGATION_MENU_ITEM",
			value: NAVIGATION_MENU_ITEM,
		},
		Ts::Const {
			name: "NAVIGATION_MENU_TRIGGER_STYLE",
			value: NAVIGATION_MENU_TRIGGER_STYLE,
		},
		Ts::Const {
			name: "NAVIGATION_MENU_CONTENT",
			value: NAVIGATION_MENU_CONTENT,
		},
		Ts::Const {
			name: "NAVIGATION_MENU_LINK",
			value: NAVIGATION_MENU_LINK,
		},
		Ts::Const {
			name: "NAVIGATION_MENU_INDICATOR",
			value: NAVIGATION_MENU_INDICATOR,
		},
		Ts::Const {
			name: "NAVIGATION_MENU_VIEWPORT",
			value: NAVIGATION_MENU_VIEWPORT,
		},
	]
}

fn hover_card() -> Vec<Ts> {
	vec![Ts::Const {
		name: "HOVER_CARD_CONTENT",
		value: HOVER_CARD_CONTENT,
	}]
}

fn progress() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "PROGRESS_TRACK",
			value: PROGRESS_TRACK,
		},
		Ts::Const {
			name: "PROGRESS_INDICATOR",
			value: PROGRESS_INDICATOR,
		},
	]
}

fn radio_group() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "RADIO_GROUP_ROOT",
			value: RADIO_GROUP_ROOT,
		},
		Ts::Const {
			name: "RADIO_GROUP_ITEM",
			value: RADIO_GROUP_ITEM,
		},
	]
}

fn card() -> Vec<Ts> {
	vec![
		Ts::Const { name: "CARD", value: CARD },
		Ts::Const {
			name: "CARD_HEADER",
			value: CARD_HEADER,
		},
		Ts::Const {
			name: "CARD_TITLE",
			value: CARD_TITLE,
		},
		Ts::Const {
			name: "CARD_DESCRIPTION",
			value: CARD_DESCRIPTION,
		},
		Ts::Const {
			name: "CARD_ACTION",
			value: CARD_ACTION,
		},
		Ts::Const {
			name: "CARD_CONTENT",
			value: CARD_CONTENT,
		},
		Ts::Const {
			name: "CARD_FOOTER",
			value: CARD_FOOTER,
		},
	]
}

fn breadcrumb() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "BREADCRUMB_LIST",
			value: BREADCRUMB_LIST,
		},
		Ts::Const {
			name: "BREADCRUMB_ITEM",
			value: BREADCRUMB_ITEM,
		},
		Ts::Const {
			name: "BREADCRUMB_LINK",
			value: BREADCRUMB_LINK,
		},
		Ts::Const {
			name: "BREADCRUMB_PAGE",
			value: BREADCRUMB_PAGE,
		},
		Ts::Const {
			name: "BREADCRUMB_SEPARATOR",
			value: BREADCRUMB_SEPARATOR,
		},
		Ts::Const {
			name: "BREADCRUMB_ELLIPSIS",
			value: BREADCRUMB_ELLIPSIS,
		},
	]
}

fn avatar() -> Vec<Ts> {
	vec![
		Ts::Const { name: "AVATAR", value: AVATAR },
		Ts::Const {
			name: "AVATAR_IMAGE",
			value: AVATAR_IMAGE,
		},
		Ts::Const {
			name: "AVATAR_FALLBACK",
			value: AVATAR_FALLBACK,
		},
	]
}

fn alert_dialog() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "ALERT_DIALOG_OVERLAY",
			value: ALERT_DIALOG_OVERLAY,
		},
		Ts::Const {
			name: "ALERT_DIALOG_CONTENT",
			value: ALERT_DIALOG_CONTENT,
		},
		Ts::Const {
			name: "ALERT_DIALOG_HEADER",
			value: ALERT_DIALOG_HEADER,
		},
		Ts::Const {
			name: "ALERT_DIALOG_FOOTER",
			value: ALERT_DIALOG_FOOTER,
		},
		Ts::Const {
			name: "ALERT_DIALOG_TITLE",
			value: ALERT_DIALOG_TITLE,
		},
		Ts::Const {
			name: "ALERT_DIALOG_DESCRIPTION",
			value: ALERT_DIALOG_DESCRIPTION,
		},
	]
}

fn sheet() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "SHEET_OVERLAY",
			value: SHEET_OVERLAY,
		},
		Ts::Const {
			name: "SHEET_CONTENT",
			value: SHEET_CONTENT,
		},
		Ts::Const {
			name: "SHEET_CLOSE",
			value: SHEET_CLOSE,
		},
		Ts::Const {
			name: "SHEET_SIDE_RIGHT",
			value: SHEET_SIDE_RIGHT,
		},
		Ts::Const {
			name: "SHEET_SIDE_LEFT",
			value: SHEET_SIDE_LEFT,
		},
		Ts::Const {
			name: "SHEET_SIDE_TOP",
			value: SHEET_SIDE_TOP,
		},
		Ts::Const {
			name: "SHEET_SIDE_BOTTOM",
			value: SHEET_SIDE_BOTTOM,
		},
		Ts::Const {
			name: "SHEET_HEADER",
			value: SHEET_HEADER,
		},
		Ts::Const {
			name: "SHEET_FOOTER",
			value: SHEET_FOOTER,
		},
		Ts::Const {
			name: "SHEET_TITLE",
			value: SHEET_TITLE,
		},
		Ts::Const {
			name: "SHEET_DESCRIPTION",
			value: SHEET_DESCRIPTION,
		},
	]
}

fn popover() -> Vec<Ts> {
	vec![Ts::Const {
		name: "POPOVER_CONTENT",
		value: POPOVER_CONTENT,
	}]
}

fn tooltip() -> Vec<Ts> {
	vec![Ts::Const {
		name: "TOOLTIP_CONTENT",
		value: TOOLTIP_CONTENT,
	}]
}

fn input() -> Vec<Ts> {
	vec![Ts::Const {
		name: "INPUT_BASE",
		value: INPUT_BASE,
	}]
}

fn label() -> Vec<Ts> {
	vec![Ts::Const {
		name: "LABEL_BASE",
		value: LABEL_BASE,
	}]
}

fn skeleton() -> Vec<Ts> {
	vec![Ts::Const {
		name: "SKELETON_BASE",
		value: SKELETON_BASE,
	}]
}

fn textarea() -> Vec<Ts> {
	vec![Ts::Const {
		name: "TEXTAREA_BASE",
		value: TEXTAREA_BASE,
	}]
}

fn kbd() -> Vec<Ts> {
	vec![
		Ts::Const { name: "KBD_BASE", value: KBD_BASE },
		Ts::Const {
			name: "KBD_GROUP_BASE",
			value: KBD_GROUP_BASE,
		},
	]
}

fn container() -> Vec<Ts> {
	vec![Ts::Const {
		name: "CONTAINER_BASE",
		value: CONTAINER_BASE,
	}]
}

fn badge() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "BADGE_BASE",
			value: BADGE_BASE,
		},
		table::<BadgeVariant>("badgeVariants", "BadgeVariant"),
	]
}

fn separator() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "SEPARATOR_BASE",
			value: SEPARATOR_BASE,
		},
		table::<Orientation>("separatorOrientations", "SeparatorOrientation"),
	]
}

fn button_group() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "BUTTON_GROUP_BASE",
			value: BUTTON_GROUP_BASE,
		},
		table::<ButtonGroupOrientation>("buttonGroupOrientationClasses", "ButtonGroupOrientation"),
		Ts::Const {
			name: "BUTTON_GROUP_TEXT_BASE",
			value: BUTTON_GROUP_TEXT_BASE,
		},
		Ts::Const {
			name: "BUTTON_GROUP_SEPARATOR_BASE",
			value: BUTTON_GROUP_SEPARATOR_BASE,
		},
	]
}

fn empty() -> Vec<Ts> {
	vec![
		Ts::Const { name: "EMPTY", value: EMPTY },
		Ts::Const {
			name: "EMPTY_HEADER",
			value: EMPTY_HEADER,
		},
		Ts::Const {
			name: "EMPTY_MEDIA_BASE",
			value: EMPTY_MEDIA_BASE,
		},
		table::<EmptyMediaVariant>("emptyMediaVariants", "EmptyMediaVariant"),
		Ts::Const {
			name: "EMPTY_TITLE",
			value: EMPTY_TITLE,
		},
		Ts::Const {
			name: "EMPTY_DESCRIPTION",
			value: EMPTY_DESCRIPTION,
		},
		Ts::Const {
			name: "EMPTY_CONTENT",
			value: EMPTY_CONTENT,
		},
	]
}

fn scroll_area() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "SCROLL_AREA_VIEWPORT",
			value: SCROLL_AREA_VIEWPORT,
		},
		Ts::Const {
			name: "SCROLL_AREA_THUMB",
			value: SCROLL_AREA_THUMB,
		},
		Ts::Const {
			name: "SCROLLBAR_BASE",
			value: SCROLLBAR_BASE,
		},
		table::<ScrollBarOrientation>("scrollBarOrientations", "ScrollBarOrientation"),
	]
}

fn alert() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "ALERT_BASE",
			value: ALERT_BASE,
		},
		table::<AlertVariant>("alertVariants", "AlertVariant"),
		Ts::Const {
			name: "ALERT_TITLE",
			value: ALERT_TITLE,
		},
		Ts::Const {
			name: "ALERT_DESCRIPTION",
			value: ALERT_DESCRIPTION,
		},
	]
}

fn toggle() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "TOGGLE_BASE",
			value: TOGGLE_BASE,
		},
		table::<ToggleVariant>("toggleVariantClasses", "ToggleVariant"),
		Ts::Table {
			name: "toggleSizeClasses",
			ty: "ToggleSize",
			entries: [(Size::Md, "default"), (Size::Sm, "sm"), (Size::Lg, "lg")]
				.into_iter()
				.map(|(s, k)| (k.to_string(), toggle_size_class(s).to_string()))
				.collect(),
		},
	]
}

fn button() -> Vec<Ts> {
	vec![
		Ts::Const {
			name: "BUTTON_BASE",
			value: BUTTON_BASE,
		},
		table::<ButtonVariant>("buttonVariantClasses", "ButtonVariant"),
		// Size×icon → shadcn's flat size keys (Md→`default`, icon variants).
		Ts::Table {
			name: "buttonSizeClasses",
			ty: "ButtonSize",
			entries: [
				(Size::Md, "default"),
				(Size::Sm, "sm"),
				(Size::Lg, "lg"),
				(Size::Md, "icon"),
				(Size::Sm, "icon-sm"),
				(Size::Lg, "icon-lg"),
			]
			.into_iter()
			.map(|(size, key)| (key.to_string(), button_size_class(size, key.starts_with("icon")).to_string()))
			.collect(),
		},
	]
}
