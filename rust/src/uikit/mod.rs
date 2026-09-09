//! `uikit` — EV-invest's dep-light Dioxus UI kit.
//!
//! Renderer-agnostic RSX components, mirrored semantically by the `@evinvest/uikit`
//! TypeScript package. Styling is Tailwind-utility based; every class references
//! a design token from `tokens.css` (repo root), the theme contract a
//! consumer must `@import` into its Tailwind v4 entrypoint.
//!
//! Variants are plain `enum`s matched to class strings (no `cva`); the `class`
//! prop is fused last via [`cn!`](crate::cn) so a caller override wins. Behaviour
//! shared by interactive components lives in [`primitives`]; see the package
//! README for the Rust↔TS map and the overlay limitations.
//!
//! ```toml
//! [target.'cfg(target_arch = "wasm32")'.dependencies]
//! ev_lib = { version = "0.10", default-features = false, features = ["uikit", "modern", "wasm"] }
//! ```

pub mod primitives;

#[cfg(test)]
mod test_util;

// Styling data lives in the Dioxus-free `ev_lib_classes` crate, the single source
// of truth the TS codegen reads too. The class strings are an implementation
// detail of the components — only the types a caller has to *name* to build a
// prop are re-exported.
pub(crate) use ev_lib_classes::*;
pub use ev_lib_classes::{
	AlertVariant, BadgeVariant, ButtonGroupOrientation, ButtonVariant, DrawerDirection, EmptyMediaVariant, FieldOrientation, InputGroupAddonAlign, InputGroupButtonSize, ItemMediaVariant,
	ItemSize, ItemVariant, Orientation, Polarity, ScrollBarOrientation, Size, Surface, ToastPosition, ToastVariant, ToggleVariant,
};

mod accordion;
mod alert;
mod avatar;
mod badge;
mod band;
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
mod section_descriptor;
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
pub use band::{Check, Display, Eyebrow, Prose, Section, SectionHead, Stat};
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
pub use section_descriptor::SectionDescriptor;
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
mod info_tip;
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
pub use info_tip::*;
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

// Site chrome — the footer grid and the 404/403/500 status pages. Both take
// their copy and their mark from the caller; the kit carries no brand.
mod footer;
mod status_screen;

pub use footer::{Footer, FooterLink, FooterLinkGroup, FooterOffice};
pub use status_screen::{Forbidden, NotFound, ServerError, StatusAccent, StatusLinkData, StatusScreen};
