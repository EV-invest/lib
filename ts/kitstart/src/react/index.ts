/**
 * `@evinvest/kitstart/react` — the structural widgets every landing shares,
 * where behaviour matters more than look. Server components by default; only
 * `MapFacade`, `AnalyticsBoundary`, `FormSelect`, `LeadCapture`, `LeadBooking`
 * and `AbSwitcher` are client modules, each its own file with its own
 * `"use client"`, so a page pays for what it renders. `AbSwitcher` is a gate
 * of a few hundred bytes; its panel (`AbSwitcherPanel`) is a dynamic import,
 * fetched only by a QA visit.
 *
 * Styled with the kit's token roles only (`text-ink`, `border-border`,
 * `bg-card`…); a brand restyles through `className`, a widget's named parts
 * (`classNames={{ list: "gap-2" }}`) and its palette. Tailwind
 * must scan the package: `@source "<path to>/node_modules/@evinvest/kitstart/dist";`,
 * relative to the stylesheet (`../../node_modules/…` from `src/app/`).
 */
export { AbSwitcher } from "./AbSwitcher";
export type { AbSwitcherExperiment, AbSwitcherProps, AbSwitcherText, AbSwitcherVariant } from "./ab-switcher-types";
export { AnalyticsBoundary, type AnalyticsBoundaryProps } from "./AnalyticsBoundary";
export { AreaChips } from "./AreaChips";
export { CallBar, type CallBarPart, type CallBarProps } from "./CallBar";
export { Coverage, type CoveragePart, type CoverageProps } from "./Coverage";
export { Faq, type FaqPart, type FaqProps } from "./Faq";
export { FormSelect, type FormSelectOption, type FormSelectPart, type FormSelectProps } from "./FormSelect";
export { LangSwitch, withLang, type LangSwitchProps } from "./LangSwitch";
export { LeadCapture, type LeadCapturePart, type LeadCaptureProps } from "./LeadCapture";
export { LeadBooking, type LeadBookingProps } from "./LeadBooking";
export type { BookingPart } from "./LeadBookingManual";
export {
  BOOKING_ADAPTERS,
  BOOKING_EMBEDS,
  bookingAdapters,
  calComAdapter,
  calComEmbedAdapter,
  calComEmbedOrigin,
  googleCalendarAdapter,
  linkAdapter,
  manualAdapter,
  type BookedSlot,
  type BookingAdapter,
  type BookingAdapters,
  type BookingContext,
} from "./booking-adapters";
export { BOOKING_ACTION } from "./use-booking";
export type { LeadSent } from "./use-lead-submit";
export type { LeadCaptureLayout, LeadNeedDisplay, LeadNeedOption } from "./LeadCaptureNeed";
export type { EstimateQuestion, EstimateQuestions } from "./LeadCaptureEstimate";
export type { LeadIntro, LeadIntroOption } from "./lead-steps";
export type { ChannelIconKey } from "./LeadCaptureChannels";
export type { MessengerPart } from "./messenger/types";
export { MapFacade, type MapFacadePart, type MapFacadeProps } from "./MapFacade";
export { PlaceDirectory, type PlaceDirectoryPart, type PlaceDirectoryProps } from "./PlaceDirectory";
export { PHONE_INPUT_PROPS, QuoteFormShell, type QuoteFormShellProps } from "./QuoteFormShell";
export { StatusScreen, type StatusScreenPart, type StatusScreenProps } from "./StatusScreen";
export type { PartClassNames } from "./parts";

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
