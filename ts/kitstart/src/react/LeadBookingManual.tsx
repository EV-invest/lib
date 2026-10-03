"use client";

import { Button, cn } from "@evinvest/uikit";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { PREFERRED_PARTS, type PreferredPart } from "../core/booking/model";
import type { LeadCaptureFlowText } from "../core/lead-capture-text";
import type { PartClassNames } from "./parts";
import type { BookingReport } from "./use-booking";

export type BookingPart = "booking" | "bookingCta" | "bookingNote" | "prefer" | "preferOption" | "preferSubmit";

/** How many days ahead a visitor may prefer: tiles, not a calendar — a tap each. */
const DAYS_AHEAD = 7;

/** `YYYY-MM-DD` in the visitor's own calendar, `n` days from `now`. */
function dayFrom(now: number, n: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Tiles<T extends string>(props: { legend: string; name: string; options: readonly { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; className?: string | undefined }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-ink">{props.legend}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {props.options.map(o => (
          <label key={o.value} className="relative block cursor-pointer">
            <input type="radio" name={props.name} value={o.value} checked={props.value === o.value} onChange={() => props.onChange(o.value)} className="peer absolute inset-0 opacity-0" />
            <span
              className={cn(
                "flex h-full min-h-11 items-center justify-center rounded-[var(--control-radius)] border border-input px-2 py-2 text-center text-sm text-ink transition-colors",
                "peer-checked:border-primary peer-checked:bg-hover peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
                props.className,
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * `manual`: the call is promised, and the visitor may say when suits them —
 * a day of the coming week and a part of the day, both optional, no free
 * text. Sent as `booking.requested@1`; the operator sets the slot on the call.
 */
export function LeadBookingManual(props: { leadRef: string; locale: string; now: number; text: LeadCaptureFlowText; report: BookingReport | null; classNames?: PartClassNames<BookingPart> | undefined }) {
  const { text, locale, classNames: c } = props;
  const [day, setDay] = useState<string | null>(null);
  const [part, setPart] = useState<PreferredPart | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "failed">("idle");
  const days = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" });
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const value = dayFrom(props.now, i + 1);
      return { value, label: fmt.format(new Date(`${value}T12:00:00`)) };
    });
  }, [locale, props.now]);
  const parts = PREFERRED_PARTS.map(value => ({ value, label: { morning: text.partMorning, afternoon: text.partAfternoon, evening: text.partEvening }[value] }));
  const report = props.report;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!report || (day === null && part === null)) return;
    setState("busy");
    const ok = await report.requested({ lead_ref: props.leadRef, provider: "manual", ...(day ? { preferred_date: day } : {}), ...(part ? { preferred_part: part } : {}) });
    setState(ok ? "sent" : "failed");
  };

  let body: ReactNode = null;
  if (state === "sent") body = <p className="text-ink">{text.preferSent}</p>;
  else if (report)
    body = (
      <form onSubmit={send} className={cn("flex flex-col gap-4", c?.prefer)} data-booking-prefer="">
        <p className="text-sm text-ink-soft">{text.preferTitle}</p>
        <Tiles legend={text.preferDay} name="preferred_date" options={days} value={day} onChange={setDay} className={c?.preferOption} />
        <Tiles legend={text.preferPart} name="preferred_part" options={parts} value={part} onChange={setPart} className={c?.preferOption} />
        {state === "failed" && (
          <p role="alert" className="text-sm text-ink">
            {text.preferFailed}
          </p>
        )}
        <Button type="submit" variant="outline" size="touch" disabled={state === "busy" || (day === null && part === null)} className={cn("w-full", c?.preferSubmit)}>
          {text.preferSubmit}
        </Button>
      </form>
    );
  return (
    <div className={cn("flex flex-col gap-4", c?.booking)}>
      <p className={cn("text-ink", c?.bookingNote)}>{text.slotCallback}</p>
      {body}
    </div>
  );
}
