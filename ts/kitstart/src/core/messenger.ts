/**
 * The messenger channels: WhatsApp, where the customer sends our prefilled
 * message, and Telegram, the brand's bot opened with a deep link. Either way
 * the lead is posted first, carrying a short reference the customer's message
 * carries too (`message_ref`) — the one thing that joins the chat to the lead.
 */

/** The form field the reference is posted under. */
export const MESSAGE_REF_FIELD = "message_ref";

/**
 * `<PREFIX>-<4..8 chars>` in Crockford base32 without I, L, O, U — read aloud
 * and typed back without a mix-up. The panel's own rule, the same regex.
 */
export const MESSAGE_REF = /^[A-Z]{2,4}-[0-9A-HJKMNP-TV-Z]{4,8}$/;

/** A brand's reference prefix (`AQ`, `VF`). */
export const MESSAGE_REF_PREFIX = /^[A-Z]{2,4}$/;

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** The random bytes a reference is drawn from; a test passes its own. */
export type RandomBytes = (length: number) => Uint8Array;

const cryptoBytes: RandomBytes = length => crypto.getRandomValues(new Uint8Array(length));

/**
 * A fresh reference, `AQ-7K3F`. Not a secret and not unique — 32⁴ per prefix
 * collide sooner or later, and the panel resolves a reference to the brand's
 * newest lead — just short enough to survive a chat.
 */
export function newMessageRef(prefix: string, random: RandomBytes = cryptoBytes): string {
  if (!MESSAGE_REF_PREFIX.test(prefix)) throw new Error(`message ref: the prefix must be 2–4 capital letters, got ${JSON.stringify(prefix)}`);
  // 32 divides 256: a byte masked to five bits draws each symbol evenly.
  const body = [...random(4)].map(b => CROCKFORD[b & 31] ?? "0").join("");
  return `${prefix}-${body}`;
}

/** A posted reference, when it is one; anything else is dropped, never refused. */
export function messageRefOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ref = value.trim().toUpperCase();
  return MESSAGE_REF.test(ref) ? ref : null;
}

/**
 * A Telegram bot's username, without `@`: Telegram's own rule for a bot — 5
 * to 32 characters, a letter first, ending in `bot` — and the panel's.
 */
export const TELEGRAM_BOT = /^[A-Za-z][A-Za-z0-9_]{1,28}[Bb][Oo][Tt]$/;

/**
 * The bot's deep link, `https://t.me/<bot>?start=<ref>`. The `start`
 * parameter allows `A-Za-z0-9_-` only — a reference always is — so anything
 * else is left off rather than encoded into a link the bot would not read.
 */
export function telegramHref(bot: string, start?: string): string {
  const name = bot.replace(/^@/, "");
  return start && /^[A-Za-z0-9_-]{1,64}$/.test(start) ? `https://t.me/${name}?start=${start}` : `https://t.me/${name}`;
}

/**
 * What a card may offer for the messengers (`messengerFacts`): the place's
 * own WhatsApp number — never the brand's phone as a fallback, the chat is
 * answered by hand — and its bot. `null` → not offered.
 */
export interface MessengerFacts {
  whatsapp: string | null;
  telegram: string | null;
}

/** Which messengers a card offered, as every event of a `LeadCapture` says it (`channels_available`). */
export type ChannelsAvailable = "wa,tg" | "wa" | "tg" | "none";

export function channelsAvailable(facts: MessengerFacts | null | undefined): ChannelsAvailable {
  const wa = Boolean(facts?.whatsapp);
  const tg = Boolean(facts?.telegram);
  return wa && tg ? "wa,tg" : wa ? "wa" : tg ? "tg" : "none";
}

/**
 * How a `LeadCapture` offers the messengers — an arm of the site's
 * `lead_channel` experiment; `undefined` is the control. Every kind falls
 * back to the control when the place has no WhatsApp (`urgency` keeps its
 * question; `thanks` keeps its Telegram button), and loses its Telegram
 * pieces when the place has no bot.
 *
 * - `select`: a channel select inside the phone field, before or after it;
 * - `segment`: «WhatsApp | Appel» over a fixed slot — the message or the phone;
 * - `tiles`: WhatsApp / Telegram / Appel tiles over the slot;
 * - `thanks`: the control's form; its success offers WhatsApp (a photo) and Telegram;
 * - `swap`: no phone until «Être rappelé» swaps the WhatsApp button for it;
 * - `saga`: the channel first, on a screen of its own, then the job;
 * - `urgency`: «C’est urgent ?» — posted as the brand's extra `field` — picks a call or WhatsApp;
 * - `sheet`: one button, the channels in a drawer;
 * - `chip`: the lede becomes a channel chip with a menu;
 * - `split`: a WhatsApp button with Telegram and call squares beside it.
 */
export type MessengerVariant =
  | { kind: "select"; side: "prefix" | "suffix" }
  | { kind: "segment" }
  | { kind: "tiles" }
  | { kind: "thanks" }
  | { kind: "swap" }
  | { kind: "saga" }
  | { kind: "urgency"; field: string }
  | { kind: "sheet" }
  | { kind: "chip" }
  | { kind: "split" };

export type MessengerKind = MessengerVariant["kind"];

/** A channel the visitor picked in a variant: a messenger, or the phone. */
export type MessengerMode = "whatsapp" | "telegram" | "call";
