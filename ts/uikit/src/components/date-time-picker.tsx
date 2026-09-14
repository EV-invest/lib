import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { buttonVariants } from "./button";
import { Calendar } from "./calendar";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  DATE_TIME_PICKER_CLEAR,
  DATE_TIME_PICKER_CONTENT,
  DATE_TIME_PICKER_TIME,
  DATE_TIME_PICKER_TIME_INPUT,
  DATE_TIME_PICKER_TIME_SEPARATOR,
  DATE_TIME_PICKER_TRIGGER,
} from "../generated/date-time-picker";

// lucide `calendar`, inlined per the kit's no-icon-dep convention.
const CALENDAR_ICON = [
  "M8 2v4",
  "M16 2v4",
  "M3 10h18",
  "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
] as const;

function CalendarIcon() {
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
      {CALENDAR_ICON.map(d => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const pad = (n: number): string => String(n).padStart(2, "0");

// The value always carries whole minutes: seconds/ms are dropped on every write.
function atMinute(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
}

/** Inclusive clamp at minute precision. */
function clampMoment(d: Date, min: Date | undefined, max: Date | undefined): Date {
  const lo = min && atMinute(min);
  const hi = max && atMinute(max);
  if (lo && d.getTime() < lo.getTime()) return lo;
  if (hi && d.getTime() > hi.getTime()) return hi;
  return d;
}

/**
 * Parses the digits an operator typed into an hours/minutes field. `null`
 * (nothing typed, or no digit at all) keeps the last value.
 *
 * The LAST two digits win: the field is controlled, so what the browser hands
 * over is the old value plus the keystroke ("01" + "5" = "015"), and the
 * freshest digits are the ones the operator meant.
 */
function parseField(raw: string, max: number): number | null {
  const digits = raw.replace(/\D/g, "").slice(-2);
  if (digits === "") return null;
  return Math.min(Number(digits), max);
}

// A focused field is replaced, not appended to: with the whole value selected,
// "1" then "5" reads as 15.
const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select();

function isoLabel(d: Date): string {
  return `${d.getFullYear().toString().padStart(4, "0")}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The picker's own strings; every one defaults to English. */
export interface DateTimePickerLabels {
  /** `aria-label` of the calendar's previous-month button; "Previous month". */
  previousMonth?: string;
  /** `aria-label` of the calendar's next-month button; "Next month". */
  nextMonth?: string;
  /** `aria-label` of the hours input; "Hours". */
  hours?: string;
  /** `aria-label` of the minutes input; "Minutes". */
  minutes?: string;
  /** Text of the clear button; "Clear". */
  clear?: string;
}

export interface DateTimePickerProps
  extends React.AriaAttributes,
    Pick<React.ComponentProps<"button">, "onFocus" | "onBlur"> {
  /** Controlled value; `null` = empty. Local-zone `Date` (seconds/ms are zeroed on every change). */
  value?: Date | null;
  /** Uncontrolled seed; default `null`. */
  defaultValue?: Date | null;
  onChange?: (value: Date | null) => void;
  /** Earliest allowed moment (inclusive, minute precision). */
  min?: Date;
  /** Latest allowed moment (inclusive, minute precision). */
  max?: Date;
  /**
   * BCP-47 tag for the trigger label and calendar captions (`Intl`). Absent →
   * `YYYY-MM-DD HH:MM` and English captions, like the Rust port.
   */
  locale?: string;
  /** Overrides the trigger label entirely (e.g. the cabinet's `formatMoment`). */
  format?: (value: Date) => string;
  /** Shown on the trigger while empty; default "". */
  placeholder?: string;
  labels?: DateTimePickerLabels;
  disabled?: boolean;
  /** Renders a hidden `<input name>` carrying unix seconds ("" when empty) for plain forms. */
  name?: string;
  /**
   * "Today" for the calendar highlight and as the day a typed time lands on
   * while empty; default `new Date()`.
   */
  today?: Date;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `PopoverContent` alignment; default "start". */
  align?: "start" | "center" | "end";
  /** Fused onto the trigger. */
  className?: string;
  /** Put on the trigger, so a `FieldLabel`'s `htmlFor` reaches it. */
  id?: string;
}

/**
 * A date + time field over the kit's own bricks: an outline trigger opening a
 * popover with the `Calendar` and two numeric hours/minutes inputs — no native
 * `datetime-local`, so the browser's locale popup never appears.
 *
 * Every edit reports through `onChange`; the popover stays open after a day
 * click (the operator still sets the time) and closes on clear. Opening moves
 * focus into the hours field; closing hands it back to the trigger unless the
 * operator already focused something else. Any other `aria-*` prop, `onFocus`
 * and `onBlur` land on the trigger.
 */
export function DateTimePicker({
  value: valueProp,
  defaultValue = null,
  onChange,
  min,
  max,
  locale,
  format,
  placeholder = "",
  labels = {},
  disabled = false,
  name,
  today = new Date(),
  open,
  defaultOpen = false,
  onOpenChange,
  align = "start",
  className,
  id,
  ...rest
}: DateTimePickerProps) {
  const [value, setValue] = useControllableState<Date | null>({
    ...(valueProp !== undefined ? { value: valueProp } : {}),
    defaultValue,
    ...(onChange ? { onChange } : {}),
  });
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const hoursRef = React.useRef<HTMLInputElement | null>(null);
  // The content lives in a Portal, so the native tab order would skip it.
  React.useEffect(() => {
    if (!isOpen) return;
    hoursRef.current?.focus();
    return () => {
      const active = document.activeElement;
      const content = hoursRef.current?.closest("[data-slot=date-time-picker-content]");
      const lost = !active || active === document.body || !!content?.contains(active);
      if (lost) {
        rootRef.current
          ?.querySelector<HTMLElement>("[data-slot=date-time-picker-trigger]")
          ?.focus();
      }
    };
  }, [isOpen]);

  const emit = (next: Date) => setValue(clampMoment(atMinute(next), min, max));
  // A fresh copy of the moment a typed time edits: the value, or midnight of
  // `today` while empty — never the consumer's own `Date` instance.
  const base = () =>
    value
      ? new Date(value.getTime())
      : new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const onSelect = (day: Date) =>
    emit(
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        value?.getHours() ?? 0,
        value?.getMinutes() ?? 0,
      ),
    );
  const onHours = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hour = parseField(e.target.value, 23);
    if (hour === null) return;
    const next = base();
    next.setHours(hour);
    emit(next);
  };
  const onMinutes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const minute = parseField(e.target.value, 59);
    if (minute === null) return;
    const next = base();
    next.setMinutes(minute);
    emit(next);
  };
  const onClear = () => {
    setValue(null);
    setOpen(false);
  };

  const label = value
    ? format
      ? format(value)
      : locale
        ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(value)
        : isoLabel(value)
    : placeholder;

  return (
    <div data-slot="date-time-picker" ref={rootRef}>
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          data-slot="date-time-picker-trigger"
          data-placeholder={value ? undefined : "true"}
          aria-haspopup="dialog"
          className={cn(
            buttonVariants({ variant: "outline", size: "md" }),
            DATE_TIME_PICKER_TRIGGER,
            className,
          )}
          disabled={disabled}
          {...(id !== undefined ? { id } : {})}
          {...rest}
        >
          <CalendarIcon />
          <span>{label}</span>
        </PopoverTrigger>
        {name !== undefined && (
          <input
            type="hidden"
            name={name}
            value={value ? String(Math.floor(value.getTime() / 1000)) : ""}
          />
        )}
        <PopoverContent
          data-slot="date-time-picker-content"
          role="dialog"
          align={align}
          className={DATE_TIME_PICKER_CONTENT}
        >
          <Calendar
            {...(value ? { selected: value } : {})}
            onSelect={onSelect}
            // The content remounts on every open, so this lands on the value's month.
            defaultMonth={value ?? min ?? today}
            today={today}
            {...(min ? { min } : {})}
            {...(max ? { max } : {})}
            {...(locale !== undefined ? { locale } : {})}
            {...(labels.previousMonth !== undefined
              ? { previousMonthLabel: labels.previousMonth }
              : {})}
            {...(labels.nextMonth !== undefined ? { nextMonthLabel: labels.nextMonth } : {})}
          />
          <div className={DATE_TIME_PICKER_TIME} data-slot="date-time-picker-time">
            <Input
              type="text"
              inputMode="numeric"
              onFocus={selectAll}
              className={DATE_TIME_PICKER_TIME_INPUT}
              ref={hoursRef}
              data-slot="date-time-picker-hours"
              aria-label={labels.hours ?? "Hours"}
              value={pad(value?.getHours() ?? 0)}
              disabled={disabled}
              onChange={onHours}
            />
            <span className={DATE_TIME_PICKER_TIME_SEPARATOR} aria-hidden>
              :
            </span>
            <Input
              type="text"
              inputMode="numeric"
              onFocus={selectAll}
              className={DATE_TIME_PICKER_TIME_INPUT}
              data-slot="date-time-picker-minutes"
              aria-label={labels.minutes ?? "Minutes"}
              value={pad(value?.getMinutes() ?? 0)}
              disabled={disabled}
              onChange={onMinutes}
            />
            <button
              type="button"
              className={buttonVariants({ variant: "ghost", size: "sm", className: DATE_TIME_PICKER_CLEAR })}
              data-slot="date-time-picker-clear"
              disabled={disabled}
              onClick={onClear}
            >
              {labels.clear ?? "Clear"}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
