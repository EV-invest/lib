import { bookingRoute } from "@evinvest/kitstart/next";
import { serverEnv } from "@/shared/config/env";

/**
 * A priced lead asking for a slot: `booking.requested@1` to the panel through
 * the lead webhook's outbox, once its `panelBooking` is on. This template has
 * no webhook, so the request is answered and dropped.
 */
export const dynamic = "force-dynamic";

export const POST = bookingRoute({ env: serverEnv });
