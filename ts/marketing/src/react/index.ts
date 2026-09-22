/**
 * `@evinvest/marketing/react` — the interactive half, a `"use client"` bundle.
 *
 * Motion primitives on `motion` (peer), form pieces on `@evinvest/uikit`
 * (peer), and the click tracker / click-to-load facade. Server-safe values
 * (motion tokens, `accented`, validation, JSON-LD) live in the `.` core — a
 * plain export from this bundle is a client reference on the server.
 */

export { Reveal, type RevealFrom, type RevealProps } from "./motion/reveal";
export { Settle, type SettleProps } from "./motion/settle";
export {
  Stagger,
  StaggerItem,
  type StaggerItemProps,
  type StaggerProps,
} from "./motion/stagger";
export { SplitText, type SplitTextProps } from "./motion/split-text";
export { CountUp, type CountUpProps } from "./motion/count-up";
export { useReduceMotion } from "./motion/reduced-motion";

export {
  useValidatedForm,
  type BoundField,
  type ValidatedForm,
  type ValidatedFormOptions,
} from "./form/use-validated-form";
export { TextField, type TextFieldProps } from "./form/text-field";
export { SentPanel, type SentPanelProps } from "./form/sent-panel";

export {
  ContactLinkTracker,
  type ContactClick,
  type ContactLinkTrackerProps,
} from "./contact-link-tracker";

export { ClickToLoad, type ClickToLoadProps } from "./click-to-load";
export { YouTubeFacade, type YouTubeFacadeProps } from "./youtube-facade";

export { H1, H2, H3, H4, H5, H6, P, type TypographyProps } from "./typography";
export { createStatusCopy } from "./status-copy";
