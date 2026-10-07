import { fillText } from "./lead-capture-format";

// Apart from `messenger.ts`, which the card's island imports for the
// reference: a bundler keeps a module whole, and only a variant's chunk
// writes the message.

/** The words of the prefilled message, one template per line; `{brand}`, `{need}`, … filled in. */
export interface MessengerMessageText {
  messageHello: string;
  messageNeed: string;
  messagePostcode: string;
  messagePrice: string;
  messageTiming: string;
  messageRef: string;
}

/** What the message says. Nothing typed about the person — no phone, no name. */
export interface MessengerMessageInput {
  brand: string;
  /** The need's label. */
  need?: string | null | undefined;
  postcode?: string | null | undefined;
  /** The estimate the page showed, formatted (`≈ 77 €`). */
  price?: string | null | undefined;
  /** When the job is wanted — an urgency or a frequency label. */
  timing?: string | null | undefined;
  ref?: string | null | undefined;
}

/** WhatsApp shows a long message whole, but the link has to fit a QR code a phone can read off a screen. */
export const MAX_MESSENGER_MESSAGE = 400;

// C0 and C1 controls, DEL, and the Unicode line and paragraph separators: a value is one line.
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;

/** One line of the message, capped: a value is a label, not a letter. */
const clean = (value: string | null | undefined, max = 80): string => (value ?? "").replace(CONTROL, " ").trim().slice(0, max);

/**
 * The prefilled message: a greeting, the need, the postcode, the estimate
 * and the timing when known, and the reference last — the line the operator
 * matches the chat by. A line without its value is left out. Past
 * `MAX_MESSENGER_MESSAGE`, the optional lines go from the bottom up; the
 * greeting and the reference stay.
 */
export function messengerMessage(input: MessengerMessageInput, text: MessengerMessageText): string {
  const line = (template: string, key: string, value: string | null | undefined): string | null => {
    const v = clean(value);
    return v === "" ? null : fillText(template, { [key]: v });
  };
  const hello = fillText(text.messageHello, { brand: clean(input.brand) });
  const ref = input.ref ? line(text.messageRef, "ref", input.ref) : null;
  const optional = [
    line(text.messageNeed, "need", input.need),
    line(text.messagePostcode, "postcode", input.postcode),
    line(text.messagePrice, "price", input.price),
    line(text.messageTiming, "timing", input.timing),
  ].filter((l): l is string => l !== null);
  const compose = (lines: readonly string[]) => [hello, ...lines, ...(ref ? [ref] : [])].join("\n");
  let kept = optional;
  while (kept.length > 0 && compose(kept).length > MAX_MESSENGER_MESSAGE) kept = kept.slice(0, -1);
  return compose(kept).slice(0, MAX_MESSENGER_MESSAGE);
}
