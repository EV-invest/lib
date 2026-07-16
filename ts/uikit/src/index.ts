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
export { Portal } from "./primitives/portal";
export type { PortalProps } from "./primitives/portal";
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
export { Textarea } from "./components/textarea";
export { Label } from "./components/label";

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

export { Logo } from "./components/logo";
export type { LogoProps } from "./components/logo";

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
  statusButtonClass,
  NotFound,
  Forbidden,
  ServerError,
} from "./components/status-screen";
export type {
  StatusAccent,
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
export * from "./components/accordion";
export * from "./components/collapsible";
export * from "./components/container";
export * from "./components/tabs";
export * from "./components/toggle";
export * from "./components/toggle-group";
export * from "./components/switch";
export * from "./components/checkbox";
export * from "./components/radio-group";
export * from "./components/slider";
export * from "./components/scroll-area";
export * from "./components/sidebar";
export * from "./components/carousel";
export * from "./components/input-otp";

// Tier C — overlay/portal components.
export * from "./components/tooltip";
export * from "./components/popover";
export * from "./components/info-tip";
export * from "./components/hover-card";
export * from "./components/dropdown-menu";
export * from "./components/context-menu";
export * from "./components/menubar";
export * from "./components/navigation-menu";
export * from "./components/dialog";
export * from "./components/alert-dialog";
export * from "./components/sheet";
export * from "./components/drawer";
export * from "./components/select";
export * from "./components/command";

// Tier D — heavy engines (dep-light: see README Limitations).
export * from "./components/chart";
export * from "./components/calendar";
export * from "./components/sonner";
export * from "./components/form";
export * from "./components/resizable";
