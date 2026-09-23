/**
 * `@evinvest/kitstart/react` — the structural widgets every landing shares,
 * where behaviour matters more than look. Server components by default; only
 * `MapFacade` and `AnalyticsBoundary` are client modules, each its own file
 * with its own `"use client"`, so a page pays for what it renders.
 *
 * Styled with the kit's token roles only (`text-ink`, `border-border`,
 * `bg-card`…); a brand restyles through `className` and its palette. Tailwind
 * must scan the package: `@source "<path to>/node_modules/@evinvest/kitstart/dist";`,
 * relative to the stylesheet (`../../node_modules/…` from `src/app/`).
 */
export { AnalyticsBoundary } from "./AnalyticsBoundary";
export { AreaChips } from "./AreaChips";
export { CallBar, type CallBarProps } from "./CallBar";
export { Coverage, type CoverageProps } from "./Coverage";
export { Faq, type FaqProps } from "./Faq";
export { LangSwitch, withLang, type LangSwitchProps } from "./LangSwitch";
export { MapFacade, type MapFacadeProps } from "./MapFacade";
export { PlaceDirectory, type PlaceDirectoryProps } from "./PlaceDirectory";
export { PHONE_INPUT_PROPS, QuoteFormShell, type QuoteFormShellProps } from "./QuoteFormShell";
export { StatusScreen, type StatusScreenProps } from "./StatusScreen";

// The kit's pieces a landing composes with, by name — the list is the surface.
// The kit ships one module per file with its own boundary, so a page that
// renders a `Button` pays for the button, and `cn` works on the server.
export {
  Badge,
  Button,
  buttonVariants,
  Check,
  cn,
  Display,
  Eyebrow,
  Field,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Prose,
  Section,
  SectionHead,
  Separator,
  Textarea,
} from "@evinvest/uikit";
export { JsonLd } from "@evinvest/marketing";
export { ClickToLoad } from "@evinvest/marketing/click-to-load";
export { ContactLinkTracker } from "@evinvest/marketing/tracker";
