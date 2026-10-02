import type { LeadCaptureText } from "./lead-capture-text";
import type { Opening } from "./place/hours";

// Apart from the words themselves, which the client island never imports:
// the strings arrive as a prop, and a bundler keeps a module's constants.

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
