import type { DayOfWeek, OpeningHours } from "./types";

/** Every place of the vertical is in France; a brand elsewhere passes its own. */
export const DEFAULT_TIME_ZONE = "Europe/Paris";

const WEEK: readonly DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The next opening after a closed moment, read from the place's real hours only. */
export interface Opening {
  day: DayOfWeek;
  /** `HH:MM`, local time, as the hours say it. */
  time: string;
  /** 0 today, 1 tomorrow, … up to 7. */
  inDays: number;
}

interface Local {
  day: number;
  minutes: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The wall clock at `timeZone`: Monday-first day index and minutes since midnight. */
function localTime(at: Date, timeZone: string): Local {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    formatters.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? "";
  const day = WEEK.findIndex(d => d === part("weekday"));
  return { day: day < 0 ? 0 : day, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

/** `HH:MM` → minutes; `24:00` is the end of the day. `null` for anything else. */
function clock(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes <= 24 * 60 ? minutes : null;
}

interface Range {
  day: number;
  from: number;
  to: number;
  /** The after-midnight half of an overnight slot: open, but not an opening. */
  carried: boolean;
}

/** The slots as minute ranges per day; a slot closing at or before it opens runs past midnight. */
function ranges(hours: readonly OpeningHours[]): Range[] {
  const out: Range[] = [];
  for (const slot of hours) {
    const from = clock(slot.opens);
    const to = clock(slot.closes);
    if (from === null || to === null) continue;
    for (const name of slot.days) {
      const day = WEEK.indexOf(name);
      if (to > from) out.push({ day, from, to, carried: false });
      else {
        out.push({ day, from, to: 24 * 60, carried: false });
        out.push({ day: (day + 1) % 7, from: 0, to, carried: true });
      }
    }
  }
  return out;
}

/** Whether the place is open at `at`. Hours we do not have are not a guess: `null`. */
export function isOpenAt(hours: readonly OpeningHours[] | null, at: Date, timeZone = DEFAULT_TIME_ZONE): boolean | null {
  if (!hours || hours.length === 0) return null;
  const now = localTime(at, timeZone);
  return ranges(hours).some(r => r.day === now.day && now.minutes >= r.from && now.minutes < r.to);
}

/** The first opening after `at`, within a week — `null` with no hours, or when open now. */
export function nextOpening(hours: readonly OpeningHours[] | null, at: Date, timeZone = DEFAULT_TIME_ZONE): Opening | null {
  if (isOpenAt(hours, at, timeZone) !== false || !hours) return null;
  const now = localTime(at, timeZone);
  const slots = ranges(hours).filter(r => !r.carried);
  for (let inDays = 0; inDays <= 7; inDays++) {
    const day = (now.day + inDays) % 7;
    const starts = slots.filter(r => r.day === day && (inDays > 0 || r.from > now.minutes)).map(r => r.from);
    if (starts.length === 0) continue;
    const from = Math.min(...starts);
    const name = WEEK[day] ?? "Monday";
    return { day: name, time: `${String(Math.floor(from / 60)).padStart(2, "0")}:${String(from % 60).padStart(2, "0")}`, inDays };
  }
  return null;
}
