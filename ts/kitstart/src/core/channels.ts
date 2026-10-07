import { telHref, whatsappHref } from "@evinvest/marketing";
import { DEFAULT_TIME_ZONE, isOpenAt, nextOpening, type Opening } from "./place/hours";
import type { OpeningHours } from "./place/types";
import { telegramHref } from "./messenger";
import { isMobilePhone, normalizePhone } from "./phone";

/**
 * The ways a visitor can reach the business, named as `contact_intent_click`
 * names them, so a channel and its event are one word. `form` is the quote
 * form; `callback` is the form cut to a phone number ("Rappelez-moi");
 * `telegram` is the brand's bot, opened with the lead's `message_ref` — drawn
 * by a `messenger` variant only, never by the resolver's list.
 */
export type CaptureChannel = "phone" | "whatsapp" | "sms" | "callback" | "form" | "telegram";

/** What decides which channels exist: the place's numbers and hours. */
export interface ChannelFacts {
  /** `contactOf(site, place)` — the place's numbers, the brand's as fallback. */
  phone: string | null;
  whatsapp: string | null;
  hours: readonly OpeningHours[] | null;
  /** Default: offered when `phone` is a French mobile — a landline drops a text. */
  sms?: boolean;
  /** Default: offered. A surface with no form to post it from turns it off. */
  callback?: boolean;
  /** The bot's username, without `@` (`messengerFacts`); absent or `null` → no Telegram. */
  telegram?: string | null;
}

export interface ChannelOptions {
  now: Date;
  timeZone?: string | undefined;
  /** Moved to the front when available — what a `default_channel` experiment sets. */
  prefer?: CaptureChannel | null | undefined;
}

export interface ResolvedChannels {
  /** The available channels, most useful first. `form` is always there. */
  order: readonly CaptureChannel[];
  /** `null` when the place has no hours: nothing is promised from a guess. */
  open: boolean | null;
  /** When closed, the next opening by the real hours; otherwise `null`. */
  nextOpening: Opening | null;
}

// Open: a person answers, so the call leads — calls convert many times what a
// form does. Closed: a call rings out, so the channels that wait for the
// morning lead, and the call goes last instead of disappearing.
const OPEN: readonly CaptureChannel[] = ["phone", "whatsapp", "sms", "form", "callback"];
const CLOSED: readonly CaptureChannel[] = ["callback", "whatsapp", "form", "sms", "phone"];

/**
 * The one channel resolver, read by `LeadCapture` and `CallBar` alike: which
 * channels exist (a channel the place cannot answer is left out, never shown
 * dead) and in which order (by its hours, now). Pure: the caller says when
 * "now" is, so the server's render and a test agree.
 */
export function resolveChannels(facts: ChannelFacts, options: ChannelOptions): ResolvedChannels {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const open = isOpenAt(facts.hours, options.now, timeZone);
  const has: Record<CaptureChannel, boolean> = {
    phone: facts.phone !== null,
    whatsapp: facts.whatsapp !== null,
    sms: facts.phone !== null && (facts.sms ?? isMobilePhone(facts.phone)),
    callback: facts.callback ?? true,
    form: true,
    // Never in the lists below: a bot is offered by a `messenger` variant,
    // with the lead posted first, not as one more bare link.
    telegram: false,
  };
  const order = (open === false ? CLOSED : OPEN).filter(c => has[c]);
  const prefer = options.prefer;
  const sorted = prefer && has[prefer] ? [prefer, ...order.filter(c => c !== prefer)] : order;
  return { order: sorted, open, nextOpening: open === false ? nextOpening(facts.hours, options.now, timeZone) : null };
}

/**
 * `sms:` with a prefilled body. `?&body=` is the form both iOS (which reads
 * `&body=`) and Android (which reads `?body=`) accept.
 */
export function smsHref(phone: string, body?: string): string {
  const number = normalizePhone(phone) ?? phone.replace(/[^\d+]/g, "");
  return body ? `sms:${number}?&body=${encodeURIComponent(body)}` : `sms:${number}`;
}

/**
 * The link a channel opens, or `null` for the two that are forms on the page.
 * `message` is the prefilled text — for `telegram`, the bot's `start`
 * parameter: the lead's `message_ref`.
 */
export function channelHref(channel: CaptureChannel, facts: Pick<ChannelFacts, "phone" | "whatsapp" | "telegram">, message?: string): string | null {
  switch (channel) {
    case "phone":
      return facts.phone ? telHref(facts.phone) : null;
    case "whatsapp":
      return facts.whatsapp ? whatsappHref(facts.whatsapp, message) : null;
    case "sms":
      return facts.phone ? smsHref(facts.phone, message) : null;
    case "telegram":
      return facts.telegram ? telegramHref(facts.telegram, message) : null;
    case "callback":
    case "form":
      return null;
  }
}
