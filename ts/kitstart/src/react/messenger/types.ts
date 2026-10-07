import type { ReactNode } from "react";
import type { LeadWire } from "../../core/lead";
import type { LeadCaptureText } from "../../core/lead-capture-text";
import type { MessengerFacts, MessengerMode, MessengerVariant } from "../../core/messenger";
import type { ChannelIconKey, Experiment } from "../LeadCaptureChannels";
import type { LeadNeedOption } from "../LeadCaptureNeed";
import type { PartClassNames } from "../parts";
import type { LeadEvents } from "../use-lead-events";

/**
 * Where in the card a variant draws: in place of the heading (`head`), under
 * it (`afterHead`), before the need (`beforeNeed`), in place of the form's
 * fields (`body`), in place of the phone and the submit (`contact`), under
 * the submit (`afterSubmit`), or in the success (`done`).
 */
export type MessengerAt = "head" | "afterHead" | "beforeNeed" | "body" | "contact" | "afterSubmit" | "done";

/** A variant as drawn: its own kind, or the control with a way to the bot (`fallback`). */
export type MessengerShown = MessengerVariant["kind"] | "fallback";

/** The parts a variant dresses; a brand sizes `messengerSlot` (92 px, 72 px) so no state of a variant moves the card. */
export type MessengerPart =
  | "messenger"
  | "messengerSlot"
  | "messengerPreview"
  | "messengerPicker"
  | "messengerOption"
  | "messengerSquare"
  | "messengerQr"
  | "messengerReturn"
  | "messengerHint";

/** How a variant asks for the card's phone field. */
export interface PhoneOptions {
  optional?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** The variant's box around the input (`PhoneField`'s `frame`). */
  frame?: (input: ReactNode) => ReactNode;
  /** The form's id, for a field drawn outside the form's element (a drawer). */
  form?: string;
  /** Under the field instead of the brand's `afterPhone`. */
  after?: ReactNode;
}

/**
 * What `LeadCapture` hands a variant: the card's facts and state, and its own
 * pieces — the phone field and the submit — so a variant arranges them and
 * never re-implements them.
 */
export interface MessengerKit {
  at: MessengerAt;
  variant: MessengerVariant;
  shown: MessengerShown;
  facts: MessengerFacts;
  /** The card's id; its form is `<id>-form`. */
  id: string;
  locale: string;
  /** The brand's name, the message's greeting. */
  brand: string;
  text: LeadCaptureText;
  wire: LeadWire;
  needs: readonly LeadNeedOption[];
  /** The need on screen, by its label — for the message. */
  needLabel: string | null;
  /** The estimate the card shows, formatted — for the message. */
  priceText: string | null;
  /** The channel the visitor is on; `null` before a variant asks (`saga`, `urgency`). */
  mode: MessengerMode | null;
  setMode: (mode: MessengerMode | null) => void;
  /** The card's reference (`message_ref`), minted once the script runs; `null` before. */
  messageRef: string | null;
  /** A new reference, once a messenger lead is posted. */
  renewRef: () => void;
  phone: (options?: PhoneOptions) => ReactNode;
  /** The card's submit — a call lead, posted as the control posts it. */
  submit: (label?: string, options?: { form?: string; className?: string }) => ReactNode;
  /** The default heading's words, for a variant that redraws the heading. */
  title: string;
  lede: string;
  events: LeadEvents;
  icons: Partial<Record<ChannelIconKey, ReactNode>> | undefined;
  experiment: Experiment | undefined;
  classNames: PartClassNames<MessengerPart> | undefined;
}
