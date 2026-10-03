"use client";

import { useCallback, useMemo } from "react";
import { EVENTS } from "../core/analytics";
import type { BookingRequestedProperties } from "../core/booking/model";
import { useAnalyticsSink } from "./analytics-context";

/** A request as the page posts it; a provider outside the closed set is the server's to refuse. */
export type PostedBooking = Omit<BookingRequestedProperties, "provider"> & { provider: string };

/** Where `LeadCapture` posts a booking request: `bookingRoute`, beside the quote route. */
export const BOOKING_ACTION = "/quote/booking";

export interface BookingReport {
  /** The visitor opened the booking (or sent a `manual` preference): the event, and `booking.requested@1` to the site. */
  requested(properties: PostedBooking): Promise<boolean>;
  /** The provider said the slot is booked. */
  booked(): void;
}

/**
 * The page's side of a booking: `lead_booking_open` / `lead_booking_done`
 * (the provider only, never the URL), and the request to the site's
 * `bookingRoute`, which the panel hears as `booking.requested@1`. The post is
 * first-party, and the page stays: a provider's page opens in a new tab.
 */
export function useBooking(provider: string, submission: string, formId: string, action = BOOKING_ACTION): BookingReport {
  const sink = useAnalyticsSink();
  const props = useMemo(() => ({ provider, form_id: formId }), [provider, formId]);
  const requested = useCallback(
    async (properties: PostedBooking) => {
      sink?.capture(EVENTS.bookingOpen, props);
      try {
        const res = await fetch(action, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submission, ...properties }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [sink, props, action, submission],
  );
  const booked = useCallback(() => sink?.capture(EVENTS.bookingDone, props), [sink, props]);
  return { requested, booked };
}
