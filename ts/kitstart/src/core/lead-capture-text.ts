import type { Opening } from "./place/hours";

/**
 * Every word `LeadCapture` prints. Plain strings, not the copy contract's
 * `Said<F>`: the form is a client island, and a function cannot cross from a
 * server page into it. A sentence that quotes something names it in braces —
 * `{need}`, `{day}`, `{time}` — and the component fills it in.
 *
 * The kit ships French and English (`LEAD_CAPTURE_TEXT`) so every brand asks
 * in the same words and an experiment's arms differ only in what it tests; a
 * brand overrides a key by spreading: `{ ...LEAD_CAPTURE_TEXT.fr, submit: "…" }`.
 */
export interface LeadCaptureText {
  title: string;
  lede: string;
  needLabel: string;
  /** Re-opens a need chosen for the visitor. */
  needChange: string;
  localityLabel: string;
  /** Names the row of communes a tap fills the locality from. */
  servedLabel: string;
  phoneLabel: string;
  /** The soft check under a number that does not read as one; it never blocks. */
  phoneHint: string;
  nameLabel: string;
  /** After an optional field's label. */
  optional: string;
  submit: string;
  privacy: string;
  /** Heads the other ways to reach the business. */
  otherChannels: string;
  call: string;
  whatsapp: string;
  sms: string;
  callback: string;
  callbackLede: string;
  callbackConsent: string;
  callbackSubmit: string;
  /** The WhatsApp and SMS message, `{need}` the need's label. */
  message: string;
  /** The same when no need is known. */
  messageGeneric: string;
  /** When closed: the next opening, from the place's real hours only. */
  openingToday: string;
  openingTomorrow: string;
  /** `{day}` is the weekday in the page's language. */
  openingLater: string;
  /** The honeypot's label — read only by a bot filling every field. */
  honeypotLabel: string;
}

const FR: LeadCaptureText = {
  title: "Recevoir un prix",
  lede: "Réponse rapide, sans engagement.",
  needLabel: "Votre besoin",
  needChange: "Modifier",
  localityLabel: "Code postal",
  servedLabel: "Communes desservies",
  phoneLabel: "Téléphone",
  phoneHint: "Vérifiez le numéro : 06 12 34 56 78 ou +33 6 12 34 56 78.",
  nameLabel: "Nom",
  optional: "facultatif",
  submit: "Recevoir le prix",
  privacy: "Votre numéro ne sert qu’à vous répondre.",
  otherChannels: "Ou contactez-nous",
  call: "Appeler",
  whatsapp: "WhatsApp",
  sms: "SMS",
  callback: "Rappelez-moi",
  callbackLede: "Laissez votre numéro, nous vous rappelons.",
  callbackConsent: "J’accepte d’être rappelé à ce numéro.",
  callbackSubmit: "Être rappelé",
  message: "Bonjour, j’ai besoin de : {need}.",
  messageGeneric: "Bonjour, je souhaite un devis.",
  openingToday: "Nous vous rappelons dès {time}.",
  openingTomorrow: "Nous vous rappelons demain dès {time}.",
  openingLater: "Nous vous rappelons {day} dès {time}.",
  honeypotLabel: "Site web",
};

const EN: LeadCaptureText = {
  title: "Get a price",
  lede: "A quick answer, no commitment.",
  needLabel: "What you need",
  needChange: "Change",
  localityLabel: "Postcode",
  servedLabel: "Towns we serve",
  phoneLabel: "Phone",
  phoneHint: "Check the number: 06 12 34 56 78 or +33 6 12 34 56 78.",
  nameLabel: "Name",
  optional: "optional",
  submit: "Get the price",
  privacy: "Your number is used only to answer you.",
  otherChannels: "Or reach us",
  call: "Call",
  whatsapp: "WhatsApp",
  sms: "Text",
  callback: "Call me back",
  callbackLede: "Leave your number and we will call you back.",
  callbackConsent: "I agree to be called back on this number.",
  callbackSubmit: "Call me back",
  message: "Hello, I need: {need}.",
  messageGeneric: "Hello, I would like a quote.",
  openingToday: "We call you back from {time}.",
  openingTomorrow: "We call you back tomorrow from {time}.",
  openingLater: "We call you back on {day} from {time}.",
  honeypotLabel: "Website",
};

export const LEAD_CAPTURE_TEXT: Readonly<Record<"fr" | "en", LeadCaptureText>> = { fr: FR, en: EN };

/** `{key}` → its value; a key with no value is left as written, visible in review. */
export function fillText(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);
}

/** `08:00` → `8 h` in French, `8:00` elsewhere; `08:30` → `8 h 30` / `8:30`. */
function clockText(hhmm: string, locale: string): string {
  const [h = "0", m = "00"] = hhmm.split(":");
  const hour = String(Number(h));
  if (locale.startsWith("fr")) return m === "00" ? `${hour} h` : `${hour} h ${m}`;
  return `${hour}:${m}`;
}

const WEEKDAY_INDEX = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 } as const;

/** The weekday in the page's language: a Monday-anchored date read back through `Intl`. */
function weekdayText(day: Opening["day"], locale: string): string {
  // 2024-01-01 was a Monday; noon UTC is the same day everywhere it matters.
  const date = new Date(Date.UTC(2024, 0, 1 + WEEKDAY_INDEX[day], 12));
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date);
}

/** The promise of the next opening, from real hours — or `null`, never an invented one. */
export function openingText(opening: Opening | null, text: Pick<LeadCaptureText, "openingToday" | "openingTomorrow" | "openingLater">, locale: string): string | null {
  if (!opening) return null;
  const time = clockText(opening.time, locale);
  if (opening.inDays === 0) return fillText(text.openingToday, { time });
  if (opening.inDays === 1) return fillText(text.openingTomorrow, { time });
  return fillText(text.openingLater, { time, day: weekdayText(opening.day, locale) });
}
