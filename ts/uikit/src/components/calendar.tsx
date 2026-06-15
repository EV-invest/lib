import * as React from "react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button";

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
  className?: string;
}

/**
 * A dep-light single-month, single-date picker. Mirrors the landing `Calendar`'s
 * class names while replacing `react-day-picker` with a hand-rolled month grid.
 * Uses the built-in `Date` (a language built-in, not a dependency) for the date
 * math; the Rust mirror does the same math by hand.
 *
 * Simplifications versus the source: one month only (no multi-month), a single
 * selected date (no range/multi), and none of the locale/dropdown/caption
 * features — see the package README.
 */
export function Calendar({
  selected,
  onSelect,
  month,
  defaultMonth,
  onMonthChange,
  today = new Date(),
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
  const caption = `${MONTHS[monthIndex]} ${year}`;

  const lead = mondayIndex(view);
  const total = new Date(year, monthIndex + 1, 0).getDate();

  // Pad leading blanks then the days, padded out to whole weeks of 7.
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const navClass = buttonVariants({
    variant: "ghost",
    size: "icon",
    className: "size-8 p-0 select-none",
  });

  return (
    <div
      data-slot="calendar"
      role="application"
      className={cn("bg-background p-3 w-fit", className)}
    >
      <div className="flex items-center justify-between gap-1 w-full px-1">
        <button
          type="button"
          className={navClass}
          aria-label="Previous month"
          onClick={() => go(-1)}
        >
          <Chevron d={CHEVRON_LEFT} />
        </button>
        <div className="text-sm font-medium select-none">{caption}</div>
        <button
          type="button"
          className={navClass}
          aria-label="Next month"
          onClick={() => go(1)}
        >
          <Chevron d={CHEVRON_RIGHT} />
        </button>
      </div>
      <table className="w-full border-collapse mt-4" role="grid">
        <thead>
          <tr className="flex">
            {WEEKDAYS.map(wd => (
              <th
                key={wd}
                scope="col"
                className="text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] select-none"
              >
                {wd}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi} className="flex w-full mt-2">
              {week.map((cell, ci) => {
                if (cell === null) {
                  return (
                    <td
                      key={ci}
                      className="relative w-full h-full p-0 aspect-square select-none"
                    />
                  );
                }
                const date = new Date(year, monthIndex, cell);
                const isSelected = sameDay(selected, date);
                const isToday = sameDay(today, date);
                return (
                  <td
                    key={ci}
                    role="gridcell"
                    aria-selected={isSelected}
                    className="relative w-full h-full p-0 text-center aspect-square select-none"
                  >
                    <button
                      type="button"
                      data-slot="calendar-day"
                      data-selected={isSelected}
                      data-today={isToday}
                      onClick={() => onSelect?.(date)}
                      className={cn(
                        buttonVariants({
                          variant: "ghost",
                          size: "icon",
                          className:
                            "size-auto w-full aspect-square font-normal leading-none",
                        }),
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : isToday
                            ? "bg-accent text-accent-foreground rounded-md"
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
