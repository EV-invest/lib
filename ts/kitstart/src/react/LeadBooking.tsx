"use client";

import { buttonVariants, cn } from "@evinvest/uikit";
import { useState } from "react";
import type { OpenBookingConfig } from "../core/booking/model";
import type { LeadCaptureFlowText } from "../core/lead-capture-text";
import { bookingAdapters, calComEmbedAdapter, type BookingAdapter, type BookingAdapters, type BookingContext } from "./booking-adapters";
import { LeadBookingManual, type BookingPart } from "./LeadBookingManual";
import type { PartClassNames } from "./parts";
import { useBooking, type BookingReport } from "./use-booking";
import type { LeadSent } from "./use-lead-submit";

export interface LeadBookingProps {
  /** The place's booking (`bookingOf(place)`), or the brand's resolved one (`bookingForVariant`). */
  booking: OpenBookingConfig;
  sent: LeadSent;
  locale: string;
  text: LeadCaptureFlowText;
  /** The built-in adapters with the brand's over them (`calComEmbedAdapter`, a future `calendly`). */
  adapters?: BookingAdapters | undefined;
  /**
   * `cal_com` as Cal.com's modal (`calComEmbedAdapter`) rather than a new
   * tab — a flag, because a server component cannot hand a client island the
   * adapter itself.
   */
  calComEmbed?: boolean | undefined;
  formId?: string | undefined;
  /** Where the request posts; `BOOKING_ACTION` by default. */
  action?: string | undefined;
  /** For the `manual` day tiles; the click's clock by default. */
  now?: number | undefined;
  classNames?: PartClassNames<BookingPart> | undefined;
}

function OpenBooking(props: { adapter: BookingAdapter; ctx: Omit<BookingContext, "onBooked">; report: BookingReport; text: LeadCaptureFlowText; classNames?: PartClassNames<BookingPart> | undefined }) {
  const { adapter, ctx, report, text, classNames: c } = props;
  const [booked, setBooked] = useState(false);
  const onBooked = () => {
    setBooked(true);
    report.booked();
  };
  const click = () => {
    void report.requested({ lead_ref: ctx.leadRef, provider: adapter.provider });
    void adapter.open?.({ ...ctx, onBooked });
  };
  const href = adapter.href?.(ctx) ?? null;
  const look = buttonVariants({ variant: "primary", size: "touch", className: cn("w-full", c?.bookingCta) });
  if (booked) return <p className={cn("font-medium text-ink", c?.bookingNote)}>{text.booked}</p>;
  return (
    <div className={cn("flex flex-col gap-3", c?.booking)}>
      {href !== null ? (
        <a href={href} target="_blank" rel="noopener noreferrer" onClick={click} className={look} data-booking-provider={adapter.provider}>
          {text.bookCta}
        </a>
      ) : (
        <button type="button" onClick={click} className={look} data-booking-provider={adapter.provider}>
          {text.bookCta}
        </button>
      )}
      <p className={cn("text-sm text-ink-soft", c?.bookingNote)}>{text.bookNote}</p>
    </div>
  );
}

/**
 * After a priced lead: how the slot is set, through the adapter of the
 * config's provider. Nothing a provider serves is requested before the visitor's click
 * — a link the browser opens, or an embed whose script loads on the click.
 * Without the lead's reference (an old route's answer) there is nothing to
 * join a booking to, and the card only promises the call.
 */
export function LeadBooking(props: LeadBookingProps) {
  const { booking, sent, text, classNames: c } = props;
  const provider = booking.provider;
  const report = useBooking(provider, sent.submission ?? "", props.formId ?? "quote", props.action);
  const proven = sent.lead !== undefined && sent.submission !== undefined;
  const adapter = bookingAdapters({ ...(props.calComEmbed ? { cal_com: calComEmbedAdapter } : {}), ...props.adapters })[provider];
  // No reference to join a booking to, or a provider no adapter knows: the call is promised.
  if (sent.lead === undefined || (provider !== "manual" && (!proven || !adapter))) return <p className={cn("text-ink", c?.bookingNote)}>{text.slotCallback}</p>;
  if (provider === "manual") return <LeadBookingManual leadRef={sent.lead} locale={props.locale} now={props.now ?? Date.now()} text={text} report={proven ? report : null} classNames={c} />;
  const ctx = { config: booking, leadRef: sent.lead, name: sent.name, phone: sent.phone, locale: props.locale };
  if (!adapter) return null;
  return <OpenBooking adapter={adapter} ctx={ctx} report={report} text={text} classNames={c} />;
}
