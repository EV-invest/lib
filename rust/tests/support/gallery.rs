// Shared source-of-truth gallery: one demo fn per primitive, every variant in
// that fn. `include!`d verbatim by both the integration test (tests/gallery.rs)
// and the generator example (examples/all_primitives.rs) — no `pub` surface is
// added to the crate. Adding a primitive to the board = one line in `GALLERY`.
//
// Rendered to static HTML via dioxus-ssr, wrapped in a page that pulls the
// Tailwind v4 browser engine (compiles utilities in-browser) plus the crate's
// own tokens.css, so the emitted classes actually paint. Playwright screenshots
// the result for visual regression; a human opens dist/index.html as the board.

use dioxus::prelude::*;
use ev_lib::uikit::*;

fn render_fragment(app: fn() -> Element) -> String {
	let mut dom = VirtualDom::new(app);
	dom.rebuild_in_place();
	dioxus_ssr::render(&dom)
}

/// The theme contract; inlined into the Tailwind-processed `<style>` so its
/// `@theme`/`:root` tokens drive the utilities. Absolute path via the manifest
/// dir so it resolves identically from the example crate and the test crate.
const TOKENS: &str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/uikit/tokens.css"));

const DIST: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/visual/dist");

fn head(title: &str) -> String {
	// ponytail: Tailwind browser CDN, pinned to the repo's tailwind version.
	// Self-contained and zero-build; the upgrade path if offline/byte-exact
	// determinism is ever needed is a vendored precompiled tailwind.css.
	format!(
		r#"<!doctype html>
<html class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.14/dist/index.global.js"></script>
<style type="text/tailwindcss">
@import "tailwindcss";
{TOKENS}
</style>
<style>
  html, body {{ background: var(--background); color: var(--foreground); }}
  /* A `transform` makes any `position: fixed` overlay descendant resolve
     against its cell, not the viewport — so open dropdowns/dialogs/tooltips
     stay boxed inside the component they belong to. */
  .stage {{ transform: translateZ(0); position: relative; }}
</style>
</head>"#
	)
}

/// One primitive, alone on a dark page — the unit Playwright screenshots.
fn standalone(title: &str, fragment: &str) -> String {
	// No `.stage` transform here: alone on the page a `position: fixed` overlay
	// should size against the viewport (full width, centred), not a collapsed
	// containing block. The transform trick is only for the board's cells.
	format!(
		"{}\n<body class=\"min-h-screen flex items-center justify-center p-10\">\n\
		 <div id=\"stage\">{fragment}</div>\n</body></html>",
		head(title)
	)
}

/// One labelled cell in the combined board.
fn cell(name: &str, fragment: &str) -> String {
	format!(
		"<section class=\"stage flex flex-col gap-3 rounded-lg border border-border bg-card/30 p-5\">\
		 <h3 class=\"text-xs font-medium uppercase tracking-wide text-muted-foreground\">{name}</h3>\
		 <div class=\"flex flex-1 flex-wrap items-center gap-3\">{fragment}</div></section>"
	)
}

/// The Figma-like board: every primitive in one scrollable grid.
fn board(cells: &str) -> String {
	format!(
		"{}\n<body class=\"min-h-screen p-8\">\n\
		 <h1 class=\"mb-6 text-2xl font-semibold\">EV UIKit — Component Library</h1>\n\
		 <div class=\"grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3\">{cells}</div>\n\
		 </body></html>",
		head("EV UIKit — Components")
	)
}

fn slug(name: &str) -> String {
	name.to_lowercase().replace(' ', "-")
}

/// Render every primitive to `tests/visual/dist/`: one standalone page each (for
/// screenshots), a `manifest.json` the spec iterates, and the combined board.
fn write_dist() {
	std::fs::create_dir_all(DIST).expect("create dist dir");
	let mut cells = String::new();
	let mut names = Vec::new();
	for (name, f) in GALLERY {
		let fragment = render_fragment(*f);
		assert!(!fragment.trim().is_empty(), "{name} rendered empty");
		std::fs::write(format!("{DIST}/{}.html", slug(name)), standalone(name, &fragment)).expect("write primitive page");
		cells.push_str(&cell(name, &fragment));
		names.push(format!("{:?}", slug(name)));
	}
	std::fs::write(format!("{DIST}/index.html"), board(&cells)).expect("write board");
	std::fs::write(format!("{DIST}/manifest.json"), format!("[{}]", names.join(","))).expect("write manifest");
}

// ── Tier A — static ────────────────────────────────────────────────────────

fn d_button() -> Element {
	rsx! {
		Button { "Default" }
		Button { variant: ButtonVariant::Secondary, "Secondary" }
		Button { variant: ButtonVariant::Outline, "Outline" }
		Button { variant: ButtonVariant::Ghost, "Ghost" }
		Button { variant: ButtonVariant::Destructive, "Destructive" }
		Button { variant: ButtonVariant::Link, "Link" }
		Button { size: ButtonSize::Sm, "Small" }
		Button { size: ButtonSize::Lg, "Large" }
		Button { size: ButtonSize::Icon, "+" }
		Button { disabled: true, "Disabled" }
	}
}

fn d_badge() -> Element {
	rsx! {
		Badge { "Default" }
		Badge { variant: BadgeVariant::Secondary, "Secondary" }
		Badge { variant: BadgeVariant::Destructive, "Destructive" }
		Badge { variant: BadgeVariant::Outline, "Outline" }
		Badge { variant: BadgeVariant::Success, "Success" }
	}
}

fn d_label() -> Element {
	rsx! { Label { "Email address" } }
}

fn d_kbd() -> Element {
	rsx! {
		KbdGroup {
			Kbd { "⌘" }
			Kbd { "K" }
		}
	}
}

fn d_avatar() -> Element {
	rsx! {
		Avatar {
			AvatarFallback { "EV" }
		}
		Avatar {
			AvatarFallback { "AB" }
		}
	}
}

fn d_separator() -> Element {
	rsx! {
		div { class: "flex flex-col gap-2 w-40",
			"Above"
			Separator {}
			"Below"
		}
	}
}

fn d_skeleton() -> Element {
	rsx! {
		div { class: "flex flex-col gap-2 w-48",
			Skeleton { class: "h-4 w-full" }
			Skeleton { class: "h-4 w-2/3" }
			Skeleton { class: "h-10 w-10 rounded-full" }
		}
	}
}

fn d_spinner() -> Element {
	rsx! { Spinner {} }
}

fn d_aspect_ratio() -> Element {
	rsx! {
		div { class: "w-64",
			AspectRatio { ratio: 16.0 / 9.0,
				div { class: "flex h-full w-full items-center justify-center rounded-md bg-muted", "16 / 9" }
			}
		}
	}
}

fn d_progress() -> Element {
	rsx! {
		div { class: "flex w-56 flex-col gap-3",
			Progress { value: 30.0 }
			Progress { value: 66.0 }
		}
	}
}

fn d_alert() -> Element {
	rsx! {
		div { class: "flex w-full max-w-md flex-col gap-3",
			Alert {
				AlertTitle { "Heads up" }
				AlertDescription { "This is a neutral informational alert." }
			}
			Alert { variant: AlertVariant::Destructive,
				AlertTitle { "Something failed" }
				AlertDescription { "Your changes could not be saved." }
			}
		}
	}
}

fn d_card() -> Element {
	rsx! {
		Card { class: "w-72",
			CardHeader {
				CardTitle { "Quy Nhon Fund" }
				CardDescription { "Coastal development thesis" }
			}
			CardContent { "Projected IRR 18.4% over a 5-year horizon." }
			CardFooter {
				Button { size: ButtonSize::Sm, "Invest" }
			}
		}
	}
}

fn d_table() -> Element {
	rsx! {
		Table { class: "w-full max-w-md",
			TableHeader {
				TableRow {
					TableHead { "Asset" }
					TableHead { "Tier" }
					TableHead { "Yield" }
				}
			}
			TableBody {
				TableRow {
					TableCell { "Ha Long" }
					TableCell { "t1" }
					TableCell { "12.0%" }
				}
				TableRow {
					TableCell { "Jungle" }
					TableCell { "t2" }
					TableCell { "18.4%" }
				}
			}
		}
	}
}

fn d_breadcrumb() -> Element {
	rsx! {
		Breadcrumb {
			BreadcrumbList {
				BreadcrumbItem {
					BreadcrumbLink { "Home" }
				}
				BreadcrumbSeparator {}
				BreadcrumbItem {
					BreadcrumbLink { "Funds" }
				}
				BreadcrumbSeparator {}
				BreadcrumbItem {
					BreadcrumbPage { "Quy Nhon" }
				}
			}
		}
	}
}

fn d_pagination() -> Element {
	rsx! {
		Pagination {
			PaginationContent {
				PaginationItem {
					PaginationPrevious {}
				}
				PaginationItem {
					PaginationLink { "1" }
				}
				PaginationItem {
					PaginationLink { "2" }
				}
				PaginationItem {
					PaginationEllipsis {}
				}
				PaginationItem {
					PaginationNext {}
				}
			}
		}
	}
}

fn d_empty() -> Element {
	rsx! {
		Empty { class: "max-w-sm",
			EmptyHeader {
				EmptyMedia { variant: EmptyMediaVariant::Icon, "★" }
				EmptyTitle { "No investments yet" }
				EmptyDescription { "Add your first position to see it here." }
			}
			EmptyContent {
				Button { size: ButtonSize::Sm, "Add position" }
			}
		}
	}
}

fn d_item() -> Element {
	rsx! {
		div { class: "flex w-80 flex-col gap-2",
			Item {
				ItemMedia { variant: ItemMediaVariant::Icon, "▲" }
				ItemContent {
					ItemTitle { "Default item" }
					ItemDescription { "Transparent surface" }
				}
			}
			Item { variant: ItemVariant::Outline,
				ItemContent {
					ItemTitle { "Outline item" }
				}
			}
			Item { variant: ItemVariant::Muted,
				ItemContent {
					ItemTitle { "Muted item" }
				}
			}
		}
	}
}

fn d_field() -> Element {
	rsx! {
		FieldSet { class: "w-72",
			FieldLegend { "Profile" }
			FieldGroup {
				Field {
					FieldLabel { "Name" }
					Input { placeholder: "Daneel Olivaw" }
					FieldDescription { "Shown on your public profile." }
				}
			}
		}
	}
}

fn d_button_group() -> Element {
	rsx! {
		ButtonGroup {
			Button { variant: ButtonVariant::Outline, "Day" }
			Button { variant: ButtonVariant::Outline, "Week" }
			Button { variant: ButtonVariant::Outline, "Month" }
		}
	}
}

// ── Tier B — interactive ───────────────────────────────────────────────────

fn d_input() -> Element {
	rsx! {
		div { class: "flex w-64 flex-col gap-2",
			Input { placeholder: "Default" }
			Input { disabled: true, placeholder: "Disabled" }
		}
	}
}

fn d_textarea() -> Element {
	rsx! { Textarea { class: "w-64", placeholder: "Investment thesis…" } }
}

fn d_checkbox() -> Element {
	rsx! {
		div { class: "flex items-center gap-2",
			Checkbox { default_checked: true }
			Label { "Accredited investor" }
		}
	}
}

fn d_switch() -> Element {
	rsx! {
		div { class: "flex items-center gap-2",
			Switch { default_checked: true }
			Label { "Email alerts" }
		}
	}
}

fn d_radio_group() -> Element {
	rsx! {
		RadioGroup { default_value: "monthly",
			div { class: "flex items-center gap-2",
				RadioGroupItem { value: "monthly" }
				Label { "Monthly" }
			}
			div { class: "flex items-center gap-2",
				RadioGroupItem { value: "annual" }
				Label { "Annual" }
			}
		}
	}
}

fn d_slider() -> Element {
	rsx! {
		div { class: "w-64",
			Slider { default_value: 40.0 }
		}
	}
}

fn d_toggle() -> Element {
	rsx! {
		Toggle { "Bold" }
		Toggle { variant: ToggleVariant::Outline, default_pressed: true, "Italic" }
		Toggle { size: ToggleSize::Sm, "Sm" }
		Toggle { size: ToggleSize::Lg, "Lg" }
	}
}

fn d_toggle_group() -> Element {
	rsx! {
		ToggleGroup { variant: ToggleVariant::Outline,
			ToggleGroupItem { default_pressed: true, "Left" }
			ToggleGroupItem { "Center" }
			ToggleGroupItem { "Right" }
		}
	}
}

fn d_tabs() -> Element {
	rsx! {
		Tabs { default_value: "overview", class: "w-72",
			TabsList {
				TabsTrigger { value: "overview", "Overview" }
				TabsTrigger { value: "returns", "Returns" }
			}
			TabsContent { value: "overview", "Overview panel" }
			TabsContent { value: "returns", "Returns panel" }
		}
	}
}

fn d_accordion() -> Element {
	rsx! {
		Accordion { class: "w-72", collapsible: true, default_value: vec!["a".to_string()],
			AccordionItem { value: "a",
				AccordionTrigger { "What is the thesis?" }
				AccordionContent { "Coastal development in emerging Vietnam." }
			}
			AccordionItem { value: "b",
				AccordionTrigger { "What are the risks?" }
				AccordionContent { "Currency, liquidity, and regulatory." }
			}
		}
	}
}

fn d_collapsible() -> Element {
	rsx! {
		Collapsible { class: "w-64", default_open: true,
			CollapsibleTrigger { "Toggle details" }
			CollapsibleContent { "Hidden details revealed here." }
		}
	}
}

fn d_input_group() -> Element {
	rsx! {
		InputGroup { class: "w-64",
			InputGroupAddon { "$" }
			InputGroupInput { placeholder: "0.00" }
			InputGroupAddon { align: InputGroupAddonAlign::InlineEnd, "USD" }
		}
	}
}

fn d_input_otp() -> Element {
	rsx! {
		InputOTP { max_length: 6,
			InputOTPGroup {
				InputOTPSlot { index: 0 }
				InputOTPSlot { index: 1 }
				InputOTPSlot { index: 2 }
			}
			InputOTPSeparator {}
			InputOTPGroup {
				InputOTPSlot { index: 3 }
				InputOTPSlot { index: 4 }
				InputOTPSlot { index: 5 }
			}
		}
	}
}

fn d_carousel() -> Element {
	rsx! {
		Carousel { class: "w-64",
			CarouselContent {
				CarouselItem {
					div { class: "flex h-32 items-center justify-center rounded-md bg-muted", "Slide 1" }
				}
				CarouselItem {
					div { class: "flex h-32 items-center justify-center rounded-md bg-muted", "Slide 2" }
				}
			}
			CarouselPrevious {}
			CarouselNext {}
		}
	}
}

fn d_calendar() -> Element {
	rsx! { Calendar {} }
}

fn d_chart() -> Element {
	let config: ChartConfig = vec![(
		"revenue".to_string(),
		ChartSeries {
			label: Some("Revenue".to_string()),
			color: Some("var(--main-accent-t2)".to_string()),
		},
	)];
	rsx! {
		ChartContainer { id: "demo", class: "w-72", config,
			div { class: "flex h-40 items-end gap-2",
				for h in [40, 72, 55, 90, 65, 80] {
					div { class: "w-8 rounded-t bg-main-accent-t2", style: "height: {h}%" }
				}
			}
		}
	}
}

// ── Tier C — overlay (shown open; the cell transform boxes the fixed layer) ──

fn d_tooltip() -> Element {
	rsx! {
		TooltipProvider {
			Tooltip { default_open: true,
				TooltipTrigger {
					Button { variant: ButtonVariant::Outline, "Hover me" }
				}
				TooltipContent { "Tooltip content" }
			}
		}
	}
}

fn d_popover() -> Element {
	rsx! {
		Popover { default_open: true,
			PopoverTrigger {
				Button { variant: ButtonVariant::Outline, "Open popover" }
			}
			PopoverContent {
				div { class: "flex flex-col gap-2",
					"Popover body"
					Button { size: ButtonSize::Sm, "Action" }
				}
			}
		}
	}
}

fn d_hover_card() -> Element {
	rsx! {
		HoverCard { default_open: true,
			HoverCardTrigger {
				Button { variant: ButtonVariant::Link, "@evinvest" }
			}
			HoverCardContent { "Institutional coastal real-estate fund." }
		}
	}
}

fn d_dropdown_menu() -> Element {
	rsx! {
		DropdownMenu { default_open: true,
			DropdownMenuTrigger {
				Button { variant: ButtonVariant::Outline, "Menu" }
			}
			DropdownMenuContent {
				DropdownMenuLabel { "Account" }
				DropdownMenuSeparator {}
				DropdownMenuItem { "Profile" }
				DropdownMenuItem { "Settings" }
				DropdownMenuItem { variant: DropdownMenuItemVariant::Destructive, "Delete" }
			}
		}
	}
}

fn d_context_menu() -> Element {
	rsx! {
		ContextMenu { default_open: true,
			ContextMenuTrigger {
				div { class: "flex h-20 w-56 items-center justify-center rounded-md border border-dashed border-border", "Right-click area" }
			}
			ContextMenuContent {
				ContextMenuItem { "Back" }
				ContextMenuItem { "Forward" }
				ContextMenuSeparator {}
				ContextMenuItem { variant: ContextMenuItemVariant::Destructive, "Delete" }
			}
		}
	}
}

fn d_menubar() -> Element {
	rsx! {
		Menubar {
			MenubarMenu { default_open: true,
				MenubarTrigger { "File" }
				MenubarContent {
					MenubarItem { "New" }
					MenubarItem { "Open" }
					MenubarSeparator {}
					MenubarItem { variant: MenubarItemVariant::Destructive, "Quit" }
				}
			}
		}
	}
}

fn d_select() -> Element {
	rsx! {
		Select { default_open: true, class: "w-56",
			SelectTrigger {
				SelectValue { placeholder: "Pick a fund" }
			}
			SelectContent {
				SelectItem { value: "ha-long", "Ha Long Teal" }
				SelectItem { value: "jungle", "Jungle Green" }
				SelectItem { value: "rice", "Rice Gold" }
			}
		}
	}
}

fn d_dialog() -> Element {
	rsx! {
		Dialog { default_open: true,
			DialogContent {
				DialogHeader {
					DialogTitle { "Edit profile" }
					DialogDescription { "Update your account details." }
				}
				DialogFooter {
					Button { variant: ButtonVariant::Outline, "Cancel" }
					Button { "Save" }
				}
			}
		}
	}
}

fn d_alert_dialog() -> Element {
	rsx! {
		AlertDialog { default_open: true,
			AlertDialogContent {
				AlertDialogHeader {
					AlertDialogTitle { "Are you absolutely sure?" }
					AlertDialogDescription { "This action cannot be undone." }
				}
				AlertDialogFooter {
					AlertDialogCancel { "Cancel" }
					AlertDialogAction { "Continue" }
				}
			}
		}
	}
}

fn d_sheet() -> Element {
	rsx! {
		Sheet { default_open: true,
			SheetContent {
				SheetHeader {
					SheetTitle { "Filters" }
					SheetDescription { "Refine the fund list." }
				}
			}
		}
	}
}

fn d_drawer() -> Element {
	rsx! {
		Drawer { default_open: true,
			DrawerContent {
				DrawerHeader {
					DrawerTitle { "Direction" }
					DrawerDescription { "Slide-up drawer." }
				}
				DrawerFooter {
					Button { "Submit" }
				}
			}
		}
	}
}

fn d_command() -> Element {
	rsx! {
		Command { class: "w-72 rounded-lg border border-border",
			CommandInput { placeholder: "Type a command…" }
			CommandList {
				CommandEmpty { "No results." }
				CommandGroup { heading: "Suggestions",
					CommandItem { value: "calendar", "Calendar" }
					CommandItem { value: "search", "Search funds" }
				}
			}
		}
	}
}

fn d_navigation_menu() -> Element {
	rsx! {
		NavigationMenu {
			NavigationMenuList {
				NavigationMenuItem { default_open: true,
					NavigationMenuTrigger { "Funds" }
					NavigationMenuContent {
						NavigationMenuLink { "Coastal" }
						NavigationMenuLink { "Urban" }
					}
				}
			}
		}
	}
}

// ── Tier D — engines / layout ──────────────────────────────────────────────

fn d_sidebar() -> Element {
	rsx! {
		div { class: "h-72 w-full overflow-hidden rounded-lg border border-border",
			SidebarProvider {
				Sidebar {
					SidebarHeader { "EV Invest" }
					SidebarContent {
						SidebarGroup {
							SidebarGroupLabel { "Platform" }
							SidebarGroupContent {
								SidebarMenu {
									SidebarMenuItem {
										SidebarMenuButton { is_active: true, "Dashboard" }
									}
									SidebarMenuItem {
										SidebarMenuButton { "Portfolio" }
									}
								}
							}
						}
					}
				}
			}
		}
	}
}

fn d_resizable() -> Element {
	rsx! {
		ResizablePanelGroup { class: "h-40 max-w-md rounded-lg border border-border",
			ResizablePanel { index: 0, default_size: 40.0,
				div { class: "flex h-full items-center justify-center p-4", "Panel A" }
			}
			ResizableHandle { index: 0 }
			ResizablePanel { index: 1, default_size: 60.0,
				div { class: "flex h-full items-center justify-center p-4", "Panel B" }
			}
		}
	}
}

fn d_scroll_area() -> Element {
	rsx! {
		ScrollArea { class: "h-32 w-56 rounded-md border border-border p-4",
			div { class: "flex flex-col gap-2",
				for i in 1..=12 {
					div { "Row {i}" }
				}
			}
		}
	}
}

fn d_form() -> Element {
	rsx! {
		Form { class: "w-72",
			FormItem {
				FormLabel { "Username" }
				FormControl {
					Input { placeholder: "daneel" }
				}
				FormDescription { "This is your public display name." }
			}
		}
	}
}

fn d_container() -> Element {
	rsx! {
		Container { class: "border border-dashed border-border py-4",
			"Centered max-width container"
		}
	}
}

/// The board. One line per primitive — the only place to edit when adding one.
#[rustfmt::skip]
const GALLERY: &[(&str, fn() -> Element)] = &[
	("Button", d_button), ("Badge", d_badge), ("Label", d_label), ("Kbd", d_kbd),
	("Avatar", d_avatar), ("Separator", d_separator), ("Skeleton", d_skeleton),
	("Spinner", d_spinner), ("AspectRatio", d_aspect_ratio), ("Progress", d_progress),
	("Alert", d_alert), ("Card", d_card), ("Table", d_table), ("Breadcrumb", d_breadcrumb),
	("Pagination", d_pagination), ("Empty", d_empty), ("Item", d_item), ("Field", d_field),
	("ButtonGroup", d_button_group),
	("Input", d_input), ("Textarea", d_textarea), ("Checkbox", d_checkbox),
	("Switch", d_switch), ("RadioGroup", d_radio_group), ("Slider", d_slider),
	("Toggle", d_toggle), ("ToggleGroup", d_toggle_group), ("Tabs", d_tabs),
	("Accordion", d_accordion), ("Collapsible", d_collapsible), ("InputGroup", d_input_group),
	("InputOTP", d_input_otp), ("Carousel", d_carousel), ("Calendar", d_calendar), ("Chart", d_chart),
	("Tooltip", d_tooltip), ("Popover", d_popover), ("HoverCard", d_hover_card),
	("DropdownMenu", d_dropdown_menu), ("ContextMenu", d_context_menu), ("Menubar", d_menubar),
	("Select", d_select), ("Dialog", d_dialog), ("AlertDialog", d_alert_dialog),
	("Sheet", d_sheet), ("Drawer", d_drawer), ("Command", d_command), ("NavigationMenu", d_navigation_menu),
	("Sidebar", d_sidebar), ("Resizable", d_resizable), ("ScrollArea", d_scroll_area),
	("Form", d_form), ("Container", d_container),
];
