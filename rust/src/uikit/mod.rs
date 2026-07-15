//! `uikit` — EV-invest's dep-light Dioxus UI kit.
//!
//! Renderer-agnostic RSX components, mirrored semantically by the `@evinvest/uikit`
//! TypeScript package. Styling is Tailwind-utility based; every class references
//! a design token from [`tokens.css`](./tokens.css), the theme contract a
//! consumer must `@import` into its Tailwind v4 entrypoint.
//!
//! Variants are plain `enum`s matched to class strings (no `cva`); the `class`
//! prop is fused last via [`cn!`](crate::cn) so a caller override wins. Behaviour
//! shared by interactive components lives in [`primitives`]; see the package
//! README for the Rust↔TS map and the overlay limitations.
//!
//! ```toml
//! [target.'cfg(target_arch = "wasm32")'.dependencies]
//! ev_lib = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["uikit", "wasm"] }
//! ```

pub mod primitives;

#[cfg(test)]
mod test_util;

// Styling data (class tables, `Size`, `ButtonVariant`) lives in the Dioxus-free
// `ev_lib_classes` crate, the single source of truth the TS codegen reads too.
pub use ev_lib_classes::{
	ACCORDION_CONTENT, ACCORDION_CONTENT_INNER, ACCORDION_HEADER, ACCORDION_ITEM, ACCORDION_TRIGGER, ALERT_BASE, ALERT_DESCRIPTION, ALERT_DIALOG_CONTENT, ALERT_DIALOG_DESCRIPTION,
	ALERT_DIALOG_FOOTER, ALERT_DIALOG_HEADER, ALERT_DIALOG_OVERLAY, ALERT_DIALOG_TITLE, ALERT_TITLE, AVATAR, AVATAR_FALLBACK, AVATAR_IMAGE, AlertVariant, BADGE_BASE, BREADCRUMB_ELLIPSIS,
	BREADCRUMB_ITEM, BREADCRUMB_LINK, BREADCRUMB_LIST, BREADCRUMB_PAGE, BREADCRUMB_SEPARATOR, BUTTON_BASE, BUTTON_GROUP_BASE, BUTTON_GROUP_SEPARATOR_BASE, BUTTON_GROUP_TEXT_BASE,
	BadgeVariant, ButtonGroupOrientation, ButtonVariant, CALENDAR_CAPTION, CALENDAR_DAY, CALENDAR_DAY_CELL, CALENDAR_DAY_EMPTY, CALENDAR_DAY_SELECTED, CALENDAR_DAY_TODAY, CALENDAR_GRID,
	CALENDAR_NAV, CALENDAR_NAV_BUTTON, CALENDAR_ROOT, CALENDAR_WEEK, CALENDAR_WEEKDAY, CALENDAR_WEEKDAY_ROW, CARD, CARD_ACTION, CARD_CONTENT, CARD_DESCRIPTION, CARD_FOOTER, CARD_HEADER,
	CARD_TITLE, CAROUSEL_CONTENT_TRACK, CAROUSEL_CONTENT_TRACK_HORIZONTAL, CAROUSEL_CONTENT_TRACK_VERTICAL, CAROUSEL_CONTENT_VIEWPORT, CAROUSEL_EDGE_FADE_NEXT, CAROUSEL_EDGE_FADE_PREV,
	CAROUSEL_ITEM, CAROUSEL_ITEM_HORIZONTAL, CAROUSEL_ITEM_VERTICAL, CAROUSEL_NAV, CAROUSEL_NEXT_HORIZONTAL, CAROUSEL_NEXT_VERTICAL, CAROUSEL_PREVIOUS_HORIZONTAL,
	CAROUSEL_PREVIOUS_VERTICAL, CHART_CONTAINER, CHART_LEGEND, CHART_TOOLTIP, COMMAND_DIALOG_COMMAND, COMMAND_DIALOG_CONTENT, COMMAND_DIALOG_OVERLAY, COMMAND_EMPTY, COMMAND_GROUP,
	COMMAND_INPUT, COMMAND_INPUT_WRAPPER, COMMAND_ITEM, COMMAND_LIST, COMMAND_ROOT, COMMAND_SEPARATOR, COMMAND_SHORTCUT, CONTAINER_BASE, CONTEXT_MENU_CHECK_ITEM, CONTEXT_MENU_CONTENT,
	CONTEXT_MENU_ITEM, CONTEXT_MENU_LABEL, CONTEXT_MENU_SEPARATOR, CONTEXT_MENU_SHORTCUT, CONTEXT_MENU_SUB_CONTENT, CONTEXT_MENU_SUB_TRIGGER, DIALOG_CLOSE, DIALOG_CONTENT,
	DIALOG_DESCRIPTION, DIALOG_FOOTER, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_TITLE, DRAWER_CONTENT_BASE, DRAWER_DESCRIPTION, DRAWER_FOOTER, DRAWER_HANDLE, DRAWER_HEADER, DRAWER_OVERLAY,
	DRAWER_TITLE, DROPDOWN_MENU_CHECK_ITEM, DROPDOWN_MENU_CONTENT, DROPDOWN_MENU_ITEM, DROPDOWN_MENU_ITEM_INDICATOR, DROPDOWN_MENU_LABEL, DROPDOWN_MENU_SEPARATOR, DROPDOWN_MENU_SHORTCUT,
	DROPDOWN_MENU_SUB_CONTENT, DROPDOWN_MENU_SUB_TRIGGER, DrawerDirection, EMPTY, EMPTY_CONTENT, EMPTY_DESCRIPTION, EMPTY_HEADER, EMPTY_MEDIA_BASE, EMPTY_TITLE, EmptyMediaVariant,
	FIELD_BASE, FIELD_CONTENT, FIELD_DESCRIPTION, FIELD_ERROR, FIELD_GROUP, FIELD_LABEL, FIELD_LEGEND, FIELD_SEPARATOR, FIELD_SEPARATOR_CONTENT, FIELD_SEPARATOR_LINE, FIELD_SET,
	FIELD_TITLE, FORM_DESCRIPTION, FORM_ITEM, FORM_LABEL, FORM_MESSAGE, FieldOrientation, HOVER_CARD_CONTENT, INPUT_BASE, INPUT_GROUP_ADDON_BASE, INPUT_GROUP_BASE, INPUT_GROUP_BUTTON_BASE,
	INPUT_GROUP_INPUT_CONTROL, INPUT_GROUP_TEXT, INPUT_GROUP_TEXTAREA_CONTROL, INPUT_OTP_CONTAINER, INPUT_OTP_GROUP, INPUT_OTP_INPUT, INPUT_OTP_SLOT, INPUT_OTP_SLOT_CARET,
	INPUT_OTP_SLOT_CARET_WRAPPER, ITEM_ACTIONS, ITEM_BASE, ITEM_CONTENT, ITEM_DESCRIPTION, ITEM_FOOTER, ITEM_GROUP, ITEM_HEADER, ITEM_MEDIA_BASE, ITEM_SEPARATOR, ITEM_TITLE,
	InputGroupAddonAlign, InputGroupButtonSize, ItemMediaVariant, ItemSize, ItemVariant, KBD_BASE, KBD_GROUP_BASE, LABEL_BASE, MENUBAR_CHECKBOX_ITEM, MENUBAR_CONTENT, MENUBAR_ITEM,
	MENUBAR_ITEM_INDICATOR, MENUBAR_LABEL, MENUBAR_RADIO_ITEM, MENUBAR_ROOT, MENUBAR_SEPARATOR, MENUBAR_SHORTCUT, MENUBAR_SUB_CONTENT, MENUBAR_SUB_TRIGGER, MENUBAR_TRIGGER, NAVIGATION_MENU,
	NAVIGATION_MENU_CONTENT, NAVIGATION_MENU_INDICATOR, NAVIGATION_MENU_ITEM, NAVIGATION_MENU_LINK, NAVIGATION_MENU_LIST, NAVIGATION_MENU_TRIGGER_STYLE, NAVIGATION_MENU_VIEWPORT,
	Orientation, POPOVER_CONTENT, PROGRESS_INDICATOR, PROGRESS_TRACK, RADIO_GROUP_ITEM, RADIO_GROUP_ROOT, RESIZABLE_GROUP, RESIZABLE_HANDLE, RESIZABLE_HANDLE_GRIP, RESIZABLE_PANEL,
	SCROLL_AREA_THUMB, SCROLL_AREA_VIEWPORT, SCROLLBAR_BASE, SEPARATOR_BASE, SHEET_CLOSE, SHEET_CONTENT, SHEET_DESCRIPTION, SHEET_FOOTER, SHEET_HEADER, SHEET_OVERLAY, SHEET_SIDE_BOTTOM,
	SHEET_SIDE_LEFT, SHEET_SIDE_RIGHT, SHEET_SIDE_TOP, SHEET_TITLE, SIDEBAR_CONTENT, SIDEBAR_FLAT, SIDEBAR_FOOTER, SIDEBAR_GROUP, SIDEBAR_GROUP_CONTENT, SIDEBAR_GROUP_LABEL, SIDEBAR_HEADER,
	SIDEBAR_INNER, SIDEBAR_INSET, SIDEBAR_MENU, SIDEBAR_MENU_BUTTON_BASE, SIDEBAR_MENU_ITEM, SIDEBAR_RAIL, SIDEBAR_SEPARATOR, SIDEBAR_TRIGGER, SIDEBAR_WRAPPER, SKELETON_BASE, SLIDER_RANGE,
	SLIDER_ROOT, SLIDER_THUMB, SLIDER_TRACK, ScrollBarOrientation, SidebarMenuButtonSize, SidebarMenuButtonVariant, Size, TABLE, TABLE_BODY, TABLE_CAPTION, TABLE_CELL, TABLE_CONTAINER,
	TABLE_FOOTER, TABLE_HEAD, TABLE_HEADER, TABLE_ROW, TABS_CONTENT, TABS_LIST, TABS_ROOT, TABS_TRIGGER, TEXTAREA_BASE, TOAST_BASE, TOAST_CLOSE, TOAST_CONTENT, TOAST_TITLE, TOASTER_BASE,
	TOGGLE_BASE, TOOLTIP_CONTENT, ToastPosition, ToastVariant, ToggleVariant, button_size_class, input_group_button_size_class, toggle_size_class,
};

mod accordion;
mod alert;
mod avatar;
mod badge;
mod breadcrumb;
mod button;
mod button_group;
mod card;
mod carousel;
mod checkbox;
mod collapsible;
mod container;
mod empty;
mod field;
mod fonts;
mod input;
mod input_group;
mod input_otp;
mod item;
mod kbd;
mod label;
mod pagination;
mod progress;
mod radio_group;
mod scroll_area;
mod separator;
mod sidebar;
mod skeleton;
mod slider;
mod spinner;
mod switch;
mod table;
mod tabs;
mod textarea;
mod toggle;
mod toggle_group;

pub use accordion::{Accordion, AccordionContent, AccordionItem, AccordionTrigger, AccordionType};
pub use alert::{Alert, AlertDescription, AlertTitle};
pub use avatar::{Avatar, AvatarFallback, AvatarImage};
pub use badge::Badge;
pub use breadcrumb::{Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator};
pub use button::{Button, button_classes};
pub use button_group::{ButtonGroup, ButtonGroupSeparator, ButtonGroupText};
pub use card::{Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle};
pub use carousel::{Carousel, CarouselContent, CarouselEdgeFade, CarouselItem, CarouselNext, CarouselOrientation, CarouselPrevious};
pub use checkbox::Checkbox;
pub use collapsible::{Collapsible, CollapsibleContent, CollapsibleTrigger};
pub use command::{Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut};
pub use container::Container;
pub use drawer::{Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerTitle, DrawerTrigger};
pub use empty::{Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle};
pub use field::{Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldLegendVariant, FieldSeparator, FieldSet, FieldTitle};
pub use fonts::Fonts;
pub use input::Input;
pub use input_group::{InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea};
pub use input_otp::{InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot};
pub use item::{Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemHeader, ItemMedia, ItemSeparator, ItemTitle};
pub use kbd::{Kbd, KbdGroup};
pub use label::Label;
pub use pagination::{Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious};
pub use progress::Progress;
pub use radio_group::{RadioGroup, RadioGroupItem};
pub use scroll_area::{ScrollArea, ScrollBar};
pub use select::{Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue};
pub use separator::Separator;
pub use sidebar::{
	Sidebar, SidebarCollapsible, SidebarContent, SidebarContext, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu,
	SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarSide, SidebarTrigger, SidebarVariant, use_sidebar,
};
pub use skeleton::Skeleton;
pub use slider::{Slider, SliderOrientation};
pub use spinner::Spinner;
pub use switch::Switch;
pub use table::{Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow};
pub use tabs::{Tabs, TabsContent, TabsList, TabsOrientation, TabsTrigger};
pub use textarea::Textarea;
pub use toggle::{Toggle, toggle_classes};
pub use toggle_group::{ToggleGroup, ToggleGroupItem};

// Tier C — overlay/portal components. Glob-exported (each module's public
// surface is its components + variant enums). Rust overlays are dep-light:
// inline fixed positioning + a backdrop, no portal/floating/focus-trap — see
// the package README "Limitations".
mod alert_dialog;
mod command;
mod context_menu;
mod dialog;
mod drawer;
mod dropdown_menu;
mod hover_card;
mod menubar;
mod navigation_menu;
mod popover;
mod select;
mod sheet;
mod tooltip;

pub use alert_dialog::*;
pub use command::*;
pub use context_menu::*;
pub use dialog::*;
pub use drawer::*;
pub use dropdown_menu::*;
pub use hover_card::*;
pub use menubar::*;
pub use navigation_menu::*;
pub use popover::*;
pub use select::*;
pub use sheet::*;
pub use tooltip::*;

// Tier D — heavy engines, hand-rolled dep-light (chart without recharts,
// calendar with manual date math, sonner toaster, form without rhf, resizable).
// See the package README "Limitations" for the fidelity gaps vs the originals.
mod calendar;
mod chart;
mod form;
mod resizable;
mod sonner;

pub use calendar::*;
pub use chart::*;
pub use form::*;
pub use resizable::*;
pub use sonner::*;

// Brand chrome — the EV site shell (Footer/Logo) and the shared status
// pages (404/403/500), shared across surfaces. The brand Header lives in
// site_conductor: with zones chromeless, the conductor is its only consumer.
mod footer;
mod logo;
mod status_screen;

pub use footer::{Footer, FooterLink, FooterLinkGroup, FooterOffice};
pub use logo::Logo;
pub use status_screen::{Forbidden, NotFound, ServerError, StatusAccent, StatusButtonVariant, StatusLinkData, StatusScreen, status_button_class};
