/**
 * `@evinvest/uikit` — EV-invest's dep-light React UI kit.
 *
 * shadcn-semantics components with **no** `@radix-ui/*` and **no** `cva`: variant
 * maps are plain objects fused with {@link cn} (`clsx` + `tailwind-merge`), and
 * overlay behaviour (portals, floating, focus traps) is hand-rolled in
 * `./primitives`. The package mirrors the `ev_lib::uikit` Rust feature semantically.
 *
 * Styling depends on the design tokens in `@evinvest/uikit/styles/tokens.css` — a
 * consumer must `@import` that file into its Tailwind v4 entrypoint.
 */

export { cn } from "./lib/cn";

export { Slot } from "./primitives/slot";
export type { SlotProps } from "./primitives/slot";
export { useControllableState } from "./primitives/use-controllable-state";
export { Portal, PortalProvider } from "./primitives/portal";
export type { PortalProps, PortalProviderProps } from "./primitives/portal";
export { useDismissableLayer } from "./primitives/dismissable-layer";
export { useFloating } from "./primitives/use-floating";
export type { Side, Align, FloatingResult } from "./primitives/use-floating";
export { useFocusScope } from "./primitives/focus-scope";
export { usePresence } from "./primitives/presence";
export { useRovingFocus } from "./primitives/use-roving-focus";
export { useHoverIntent } from "./primitives/use-hover-intent";
export type { HoverIntentHandlers } from "./primitives/use-hover-intent";
export { mergeRefs } from "./primitives/merge-refs";

export { Alert, AlertTitle, AlertDescription } from "./components/alert";
export type { AlertProps, AlertVariant } from "./components/alert";

export { Avatar, AvatarImage, AvatarFallback } from "./components/avatar";

export { Badge } from "./components/badge";
export type { BadgeProps, BadgeVariant } from "./components/badge";

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./components/breadcrumb";
export type { BreadcrumbLinkProps } from "./components/breadcrumb";

export { Button, buttonVariants } from "./components/button";
export type {
  Accent,
  ButtonProps,
  ButtonVariant,
  ButtonSize,
  ButtonVariantsOptions,
} from "./components/button";

export {
  ButtonGroup,
  ButtonGroupText,
  ButtonGroupSeparator,
} from "./components/button-group";
export type {
  ButtonGroupOrientation,
  ButtonGroupProps,
  ButtonGroupTextProps,
} from "./components/button-group";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./components/card";

export {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "./components/empty";
export type { EmptyMediaVariant, EmptyMediaProps } from "./components/empty";

export {
  Field,
  FieldSet,
  FieldLegend,
  FieldGroup,
  FieldContent,
  FieldLabel,
  FieldTitle,
  FieldDescription,
  FieldSeparator,
  FieldError,
} from "./components/field";
export type { FieldOrientation } from "./components/field";

export { SectionDescriptor } from "./components/section-descriptor";
export type { SectionDescriptorProps } from "./components/section-descriptor";

export { Footer } from "./components/footer";
export type {
  FooterProps,
  FooterLink,
  FooterLinkGroup,
  FooterOffice,
} from "./components/footer";

export { Input } from "./components/input";
export type { InputProps, InputSize } from "./components/input";
export { Textarea } from "./components/textarea";
export type { TextareaProps, TextareaSize } from "./components/textarea";
export { Label } from "./components/label";

export { Logo } from "./components/logo";
export type { LogoProps } from "./components/logo";

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "./components/input-group";
export type {
  InputGroupAddonAlign,
  InputGroupButtonSize,
  InputGroupAddonProps,
  InputGroupButtonProps,
} from "./components/input-group";

export {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemHeader,
  ItemFooter,
  ItemGroup,
  ItemSeparator,
} from "./components/item";
export type {
  ItemVariant,
  ItemSize,
  ItemMediaVariant,
  ItemProps,
  ItemMediaProps,
} from "./components/item";

export { Kbd, KbdGroup } from "./components/kbd";


export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "./components/pagination";
export type { PaginationLinkProps } from "./components/pagination";

export { Progress } from "./components/progress";
export type { ProgressProps } from "./components/progress";

export { Separator } from "./components/separator";
export type { SeparatorOrientation, SeparatorProps } from "./components/separator";

export { Skeleton } from "./components/skeleton";
export { Spinner } from "./components/spinner";

export {
  StatusScreen,
  NotFound,
  Forbidden,
  ServerError,
  statusCtaClass,
} from "./components/status-screen";
export type {
  StatusLinkData,
  StatusScreenProps,
  StatusPageProps,
  ServerErrorProps,
} from "./components/status-screen";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./components/table";

// Tier B — self-contained interactive components.
export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./components/accordion";
export type {
  AccordionItemProps,
  AccordionProps,
} from "./components/accordion";
export {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./components/collapsible";
export type {
  CollapsibleProps,
} from "./components/collapsible";
export {
  Container,
} from "./components/container";
export type {
  ContainerProps,
} from "./components/container";
export {
  Check,
  Display,
  Eyebrow,
  Prose,
  Section,
  SectionHead,
  Stat,
} from "./components/band";
export type {
  Polarity,
  SectionHeadProps,
  SectionProps,
  StatProps,
  Surface,
} from "./components/band";
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/tabs";
export type {
  TabsContentProps,
  TabsProps,
  TabsTriggerProps,
} from "./components/tabs";
export {
  Toggle,
  toggleVariants,
} from "./components/toggle";
export type {
  ToggleProps,
  ToggleSize,
  ToggleVariant,
  ToggleVariantsOptions,
} from "./components/toggle";
export {
  ToggleGroup,
  ToggleGroupItem,
} from "./components/toggle-group";
export type {
  ToggleGroupItemProps,
  ToggleGroupProps,
} from "./components/toggle-group";
export {
  Switch,
} from "./components/switch";
export type {
  SwitchProps,
} from "./components/switch";
export {
  Checkbox,
} from "./components/checkbox";
export type {
  CheckboxProps,
} from "./components/checkbox";
export {
  RadioGroup,
  RadioGroupItem,
} from "./components/radio-group";
export type {
  RadioGroupItemProps,
  RadioGroupProps,
} from "./components/radio-group";
export {
  Slider,
} from "./components/slider";
export type {
  SliderProps,
} from "./components/slider";
export {
  ScrollArea,
  ScrollBar,
} from "./components/scroll-area";
export type {
  ScrollBarOrientation,
  ScrollBarProps,
} from "./components/scroll-area";
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./components/sidebar";
export type {
  SidebarGroupLabelProps,
  SidebarMenuButtonProps,
  SidebarMenuButtonSize,
  SidebarProps,
  SidebarProviderProps,
} from "./components/sidebar";
export {
  Carousel,
  CarouselContent,
  CarouselEdgeFade,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./components/carousel";
export type {
  CarouselProps,
} from "./components/carousel";
export {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "./components/input-otp";
export type {
  InputOTPProps,
  InputOTPSlotProps,
} from "./components/input-otp";

// Tier C — overlay/portal components.
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/tooltip";
export type {
  TooltipContentProps,
  TooltipProps,
  TooltipProviderProps,
  TooltipTriggerProps,
} from "./components/tooltip";
export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "./components/popover";
export type {
  PopoverAnchorProps,
  PopoverContentProps,
  PopoverProps,
  PopoverTriggerProps,
} from "./components/popover";
export {
  InfoTip,
  InfoTipContent,
  InfoTipTrigger,
} from "./components/info-tip";
export type {
  InfoTipContentProps,
  InfoTipProps,
  InfoTipTriggerProps,
} from "./components/info-tip";
export {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "./components/hover-card";
export type {
  HoverCardContentProps,
  HoverCardProps,
  HoverCardTriggerProps,
} from "./components/hover-card";
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./components/dropdown-menu";
export type {
  DropdownMenuCheckboxItemProps,
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuLabelProps,
  DropdownMenuProps,
  DropdownMenuRadioGroupProps,
  DropdownMenuRadioItemProps,
  DropdownMenuSubProps,
  DropdownMenuSubTriggerProps,
  DropdownMenuTriggerProps,
} from "./components/dropdown-menu";
export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./components/context-menu";
export type {
  ContextMenuCheckboxItemProps,
  ContextMenuItemProps,
  ContextMenuLabelProps,
  ContextMenuProps,
  ContextMenuRadioGroupProps,
  ContextMenuRadioItemProps,
  ContextMenuSubProps,
  ContextMenuSubTriggerProps,
  ContextMenuTriggerProps,
} from "./components/context-menu";
export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "./components/menubar";
export type {
  MenubarMenuProps,
  MenubarRadioGroupProps,
  MenubarSubProps,
} from "./components/menubar";
export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
} from "./components/navigation-menu";
export type {
  NavigationMenuItemProps,
} from "./components/navigation-menu";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./components/dialog";
export type {
  DialogCloseProps,
  DialogContentProps,
  DialogOverlayProps,
  DialogPortalProps,
  DialogProps,
  DialogTriggerProps,
} from "./components/dialog";
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./components/alert-dialog";
export type {
  AlertDialogActionProps,
  AlertDialogCancelProps,
  AlertDialogContentProps,
  AlertDialogOverlayProps,
  AlertDialogProps,
  AlertDialogTriggerProps,
} from "./components/alert-dialog";
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  SheetTrigger,
} from "./components/sheet";
export type {
  SheetCloseProps,
  SheetContentProps,
  SheetOverlayProps,
  SheetProps,
  SheetTriggerProps,
} from "./components/sheet";
export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle,
  DrawerTrigger,
} from "./components/drawer";
export type {
  DrawerCloseProps,
  DrawerDirection,
  DrawerProps,
  DrawerTriggerProps,
} from "./components/drawer";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./components/select";
export type {
  SelectContentProps,
  SelectItemProps,
  SelectProps,
  SelectTriggerProps,
  SelectTriggerSize,
  SelectValueProps,
} from "./components/select";
export {
  NativeSelect,
  NativeSelectGroup,
  NativeSelectOption,
} from "./components/native-select";
export type {
  NativeSelectProps,
  NativeSelectSize,
} from "./components/native-select";
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./components/command";
export type {
  CommandDialogProps,
  CommandGroupProps,
  CommandItemProps,
  CommandProps,
} from "./components/command";

// Tier D — heavy engines (dep-light: see README Limitations).
export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
} from "./components/chart";
export type {
  ChartConfig,
  ChartItem,
} from "./components/chart";
export {
  Calendar,
} from "./components/calendar";
export type {
  CalendarProps,
} from "./components/calendar";
export {
  DateTimePicker,
} from "./components/date-time-picker";
export type {
  DateTimePickerLabels,
  DateTimePickerProps,
} from "./components/date-time-picker";
export {
  Toaster,
  toast,
} from "./components/sonner";
export type {
  Toast,
  ToastFn,
  ToastOptions,
  ToastPosition,
  ToastState,
  ToastVariant,
  ToasterProps,
} from "./components/sonner";
export {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "./components/form";
export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/resizable";
export type {
  ResizableDirection,
  ResizableHandleProps,
  ResizablePanelGroupProps,
  ResizablePanelProps,
} from "./components/resizable";

// Features — screens composed from the bricks above.
export {
  OpenOrdersEmpty,
  OrderBook,
  OrderBookHead,
  OrderBookRow,
  OrderBookSpread,
  OrderForm,
  OrderFormRow,
  OrderFormSubmit,
  Terminal,
  TerminalChart,
  TerminalPane,
  TerminalPaneBody,
  TerminalPaneHeader,
  TerminalTicker,
  TickerStat,
  TradesTapeRow,
} from "./components/terminal";
export type {
  BookSide,
  OrderBookHeadProps,
  OrderBookRowProps,
  OrderFormRowProps,
  OrderFormSubmitProps,
  OrderSide,
  TerminalArea,
  TerminalPaneProps,
  TickerStatProps,
  TradesTapeRowProps,
} from "./components/terminal";
