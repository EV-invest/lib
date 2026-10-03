"use client";

import { Button, cn } from "@evinvest/uikit";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { bookingFrameUrl } from "../core/booking";
import { fillText, formatCents } from "../core/lead-capture-format";
import type { LeadCaptureFlowText } from "../core/lead-capture-text";
import type { PlaceBooking } from "../core/place/types";
import type { LeadSent } from "./use-lead-submit";
import type { PartClassNames } from "./parts";

// Its own chunk: Calendly is framed only after the click that asks for it.
const BookingFrame = lazy(() => import("./BookingFrame"));

export type BookingPart = "booking" | "bookingPrice" | "bookingCta" | "bookingNote";

/**
 * After a priced lead: the price the server took it at, then the slot —
 * "Choisir un créneau" opens the place's Calendly page, prefilled with the
 * visitor's name and phone and the lead's reference, so the booking joins the
 * lead. The lead is stored before any of this, so an abandoned booking is
 * still a lead to call. No booking page → the callback promise.
 */
export function LeadCaptureBooking(props: {
  sent: LeadSent;
  booking: PlaceBooking | null;
  locale: string;
  text: LeadCaptureFlowText;
  onOpen: () => void;
  onBooked: () => void;
  classNames?: PartClassNames<BookingPart> | undefined;
}) {
  const { sent, booking, locale, text, onBooked, classNames: c } = props;
  const [open, setOpen] = useState(false);
  const [booked, setBooked] = useState(false);
  // Calendly may say it twice (a reload inside the frame); the slot is booked once.
  const told = useRef(false);
  const scheduled = useCallback(() => {
    setBooked(true);
    if (told.current) return;
    told.current = true;
    onBooked();
  }, [onBooked]);
  const src = booking ? bookingFrameUrl(booking.url, { name: sent.name, phone: sent.phone || null, leadRef: sent.lead ?? null, embedDomain: window.location.host }) : null;
  return (
    <div className={cn("flex flex-col gap-3", c?.booking)}>
      {sent.cents !== undefined && <p className={cn("font-medium text-ink", c?.bookingPrice)}>{fillText(text.sentPrice, { price: formatCents(sent.cents, locale) })}</p>}
      {booked ? (
        <p className={cn("text-ink", c?.bookingNote)}>{text.bookingDone}</p>
      ) : src ? (
        <Button
          type="button"
          size="touch"
          className={cn("w-full", c?.bookingCta)}
          data-intent="booking"
          onClick={() => {
            setOpen(true);
            props.onOpen();
          }}
        >
          {text.bookingCta}
        </Button>
      ) : (
        <p className={cn("text-ink", c?.bookingNote)}>{text.bookingFallback}</p>
      )}
      {open && src && (
        <Suspense fallback={null}>
          <BookingFrame src={src} title={text.bookingCta} closeLabel={text.bookingClose} onClose={() => setOpen(false)} onScheduled={scheduled} />
        </Suspense>
      )}
    </div>
  );
}
