import * as React from "react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button";
import {
  CALENDAR_CAPTION,
  CALENDAR_DAY,
  CALENDAR_DAY_CELL,
  CALENDAR_DAY_EMPTY,
  CALENDAR_DAY_SELECTED,
  CALENDAR_DAY_TODAY,
  CALENDAR_GRID,
  CALENDAR_NAV,
  CALENDAR_NAV_BUTTON,
  CALENDAR_ROOT,
  CALENDAR_WEEK,
  CALENDAR_WEEKDAY,
  CALENDAR_WEEKDAY_ROW,
} from "../generated/calendar";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

// Week starts Monday.
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

const CHEVRON_LEFT = "m15 18-6-6 6-6";
const CHEVRON_RIGHT = "m9 18 6-6-6-6";

function Chevron({ d }: { d: string }) {
  return (
    <svg
      className="size-4"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Monday = 0 … Sunday = 6 (the built-in `Date.getDay` is Sunday = 0).
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function sameDay(a: Date | undefined, b: Date): boolean {
  return (
    !!a &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Day-granular: `min`/`max` may carry a time, but the grid only knows days.
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function outOfRange(day: Date, min: Date | undefined, max: Date | undefined): boolean {
  const t = day.getTime();
  return (
    (!!min && t < startOfDay(min).getTime()) ||
    (!!max && t > startOfDay(max).getTime())
  );
}

// Intl reads the weekday off the reference date; 2024-01-01 is a Monday.
const MONDAY = new Date(2024, 0, 1);

function localisedWeekdays(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(MONDAY.getFullYear(), MONDAY.getMonth(), MONDAY.getDate() + i)),
  );
}

export interface CalendarProps {
  /** The currently selected day, if any. */
  selected?: Date;
  /** Fired with the day a user activates. */
  onSelect?: (date: Date) => void;
  /** Controlled displayed month (any day in it is fine). */
  month?: Date;
  /** Uncontrolled initial displayed month. */
  defaultMonth?: Date;
  /** Fired when the displayed month changes via the nav buttons. */
  onMonthChange?: (month: Date) => void;
  /** "Today", highlighted in the grid; defaults to the real current date. */
  today?: Date;
  /** Earliest selectable day (inclusive, day granularity); earlier days render disabled. */
  min?: Date;
  /** Latest selectable day (inclusive, day granularity); later days render disabled. */
  max?: Date;
  /** Disables the whole grid and the nav buttons; every day renders `data-disabled`. */
  disabled?: boolean;
  /** `aria-label` of the previous-month button; "Previous month" by default. */
  previousMonthLabel?: string;
  /** `aria-label` of the next-month button; "Next month" by default. */
  nextMonthLabel?: string;
  /**
   * BCP-47 tag for the month caption and weekday headers via `Intl`
   * (Monday-first). Absent → the English constants, byte-identical to Rust.
   */
  locale?: string;
  className?: string;
}

/**
 * A dep-light single-month, single-date picker. Mirrors the landing `Calendar`'s
 * class names while replacing `react-day-picker` with a hand-rolled month grid.
 * Uses the built-in `Date` (a language built-in, not a dependency) for the date
 * math; the Rust mirror does the same math by hand.
 *
 * Simplifications versus the source: one month only (no multi-month), a single
 * selected date (no range/multi), no dropdown captions; `locale` only swaps the
 * caption and weekday strings through `Intl` — see the package README.
 */
export function Calendar({
  selected,
  onSelect,
  month,
  defaultMonth,
  onMonthChange,
  today = new Date(),
  min,
  max,
  disabled = false,
  previousMonthLabel = "Previous month",
  nextMonthLabel = "Next month",
  locale,
  className,
}: CalendarProps) {
  const [internal, setInternal] = React.useState(() =>
    startOfMonth(defaultMonth ?? new Date()),
  );
  const view = month ? startOfMonth(month) : internal;

  const go = (delta: number) => {
    const next = new Date(view.getFullYear(), view.getMonth() + delta, 1);
    if (!month) setInternal(next);
    onMonthChange?.(next);
  };

  const year = view.getFullYear();
  const monthIndex = view.getMonth();
  const caption = locale
    ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(view)
    : `${MONTHS[monthIndex]} ${year}`;
  const weekdays: readonly string[] = locale ? localisedWeekdays(locale) : WEEKDAYS;

  const lead = mondayIndex(view);
  const total = new Date(year, monthIndex + 1, 0).getDate();

  // Pad leading blanks then the days, then pad out to a fixed 6 weeks (42
  // cells): 6 rows is the most any month needs with a Monday-first week, and a
  // constant row count keeps the popover height from jumping as the user
  // flips months. Mirrors Rust.
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) cells.push(day);
  while (cells.length < 42) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const navClass = buttonVariants({
    variant: "ghost",
    size: "md",
    icon: true,
    className: CALENDAR_NAV_BUTTON,
  });

  return (
    <div
      data-slot="calendar"
      role="application"
      className={cn(CALENDAR_ROOT, className)}
    >
      <div className={CALENDAR_NAV}>
        <button
          type="button"
          className={navClass}
          aria-label={previousMonthLabel}
          disabled={disabled}
          onClick={() => go(-1)}
        >
          <Chevron d={CHEVRON_LEFT} />
        </button>
        <div data-slot="calendar-caption" className={CALENDAR_CAPTION}>
          {caption}
        </div>
        <button
          type="button"
          className={navClass}
          aria-label={nextMonthLabel}
          disabled={disabled}
          onClick={() => go(1)}
        >
          <Chevron d={CHEVRON_RIGHT} />
        </button>
      </div>
      <table className={CALENDAR_GRID} role="grid">
        <thead>
          <tr className={CALENDAR_WEEKDAY_ROW}>
            {weekdays.map((wd, i) => (
              <th
                key={i}
                scope="col"
                className={CALENDAR_WEEKDAY}
              >
                {wd}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi} className={CALENDAR_WEEK}>
              {week.map((cell, ci) => {
                if (cell === null) {
                  return (
                    <td
                      key={ci}
                      className={CALENDAR_DAY_EMPTY}
                    />
                  );
                }
                const date = new Date(year, monthIndex, cell);
                const isSelected = sameDay(selected, date);
                const isToday = sameDay(today, date);
                const isDisabled = disabled || outOfRange(date, min, max);
                return (
                  <td
                    key={ci}
                    role="gridcell"
                    aria-selected={isSelected}
                    className={CALENDAR_DAY_CELL}
                  >
                    <button
                      type="button"
                      data-slot="calendar-day"
                      data-selected={isSelected}
                      data-today={isToday}
                      // Absent rather than "false", so the unbounded grid renders as before.
                      {...(isDisabled ? { "data-disabled": "true", disabled: true } : {})}
                      onClick={() => {
                        if (!isDisabled) onSelect?.(date);
                      }}
                      className={cn(
                        buttonVariants({
                          variant: "ghost",
                          size: "md",
                          icon: true,
                          className: CALENDAR_DAY,
                        }),
                        isSelected
                          ? CALENDAR_DAY_SELECTED
                          : isToday
                            ? CALENDAR_DAY_TODAY
                            : undefined,
                      )}
                    >
                      {cell}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
