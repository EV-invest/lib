import { bookingHref } from "../core/booking/url";
import type { OpenBookingConfig } from "../core/booking/model";

/** What a provider may say about the slot it booked; all optional, never shown as is. */
export interface BookedSlot {
  startAt?: string;
  endAt?: string;
}

/** What the page hands an adapter when the visitor asks for a slot. */
export interface BookingContext {
  /** The booking the card offers — the place's (`bookingOf`), or the brand's resolved one (`bookingForVariant`). */
  config: OpenBookingConfig;
  /** The lead's public reference — the panel's lead id, and the join key every provider carries back. */
  leadRef: string;
  name?: string | null | undefined;
  phone?: string | null | undefined;
  locale: string;
  /** Called when the provider says on the page that the slot is booked. */
  onBooked?: (slot?: BookedSlot) => void;
}

/**
 * How a provider opens its booking — one adapter per provider, picked by the
 * config's `provider`; a new one (`calendly`, `google_calendar`) is one more
 * entry a brand registers (`bookingAdapters`), and `LeadCapture` is not
 * touched. `href` renders a plain link — opened by the browser, so no popup
 * blocker and nothing fetched before the click; `open` runs on the click
 * instead (an embed that loads its script then). Neither may touch the
 * network before the click.
 */
export interface BookingAdapter<P extends string = string> {
  provider: P;
  href?: (ctx: BookingContext) => string | null;
  open?: (ctx: BookingContext) => void | Promise<void>;
}

/** `manual`: no page to open — the card promises the call and offers a preference. */
export const manualAdapter: BookingAdapter<"manual"> = { provider: "manual" };

/** `link`: the page with `ref=<leadRef>`, in a new tab. */
export const linkAdapter: BookingAdapter<"link"> = {
  provider: "link",
  href: ctx => (ctx.config.provider === "link" && ctx.config.url ? bookingHref({ provider: "link", url: ctx.config.url }, { leadRef: ctx.leadRef }) : null),
};

/** The built-in `cal_com` config, or `null` for any other. */
const calCom = (config: OpenBookingConfig): { provider: "cal_com"; url: string } | null =>
  config.provider === "cal_com" && config.url ? { provider: "cal_com", url: config.url } : null;

/** `cal_com`: the event page with the name, phone and `metadata[ref]` prefilled, in a new tab. */
export const calComAdapter: BookingAdapter<"cal_com"> = {
  provider: "cal_com",
  href: ctx => {
    const config = calCom(ctx.config);
    return config && bookingHref(config, { leadRef: ctx.leadRef, name: ctx.name, phone: ctx.phone });
  },
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

type CalApi = ((...args: unknown[]) => void) & { q?: unknown[][]; loaded?: boolean; ns?: Record<string, unknown> };
type CalWindow = Window & { Cal?: CalApi };

/** Cal.com's own queue stub, as its embed snippet installs it; the script is added on the first call. */
function calQueue(w: CalWindow, script: string): CalApi {
  if (w.Cal) return w.Cal;
  const cal: CalApi = (...args: unknown[]) => {
    if (!cal.loaded) {
      cal.ns = {};
      const el = w.document.createElement("script");
      el.src = script;
      el.async = true;
      w.document.head.appendChild(el);
      cal.loaded = true;
    }
    (cal.q ??= []).push(args);
  };
  w.Cal = cal;
  return cal;
}

/** The hosted cloud serves its embed from `app.cal.com`; a self-hosted Cal.com from its own host. */
export function calComEmbedOrigin(url: string): string {
  const u = new URL(url);
  return u.hostname === "cal.com" ? "https://app.cal.com" : u.origin;
}

/**
 * `cal_com` as Cal.com's modal on the page, opt-in: its script loads only on
 * the click (no third-party request on page view), and its
 * `bookingSuccessful` event is `onBooked` — the one way the page learns a
 * slot was taken. `LeadCapture`'s `calComEmbed` turns it on.
 */
export const calComEmbedAdapter: BookingAdapter<"cal_com"> = {
  provider: "cal_com",
  open: ctx => {
    const config = calCom(ctx.config);
    if (!config) return;
    const origin = calComEmbedOrigin(config.url);
    const cal = calQueue(window, `${origin}/embed/embed.js`);
    const href = bookingHref(config, { leadRef: ctx.leadRef, name: ctx.name, phone: ctx.phone });
    if (href === null) return;
    const u = new URL(href);
    const prefill = Object.fromEntries(u.searchParams);
    let done = false;
    const booked = (e: unknown) => {
      if (done) return;
      done = true;
      const detail = isObject(e) ? e.detail : undefined;
      const data = isObject(detail) && isObject(detail.data) ? detail.data : undefined;
      const startAt = data?.startTime ?? data?.date;
      const endAt = data?.endTime;
      ctx.onBooked?.({ ...(typeof startAt === "string" ? { startAt } : {}), ...(typeof endAt === "string" ? { endAt } : {}) });
    };
    cal("init", { origin });
    cal("on", { action: "bookingSuccessful", callback: booked });
    cal("on", { action: "bookingSuccessfulV2", callback: booked });
    cal("modal", { calLink: u.pathname.slice(1), config: prefill });
  },
};

/** Adapters by provider: the built-ins, and whatever a brand registers. */
export type BookingAdapters = Readonly<Record<string, BookingAdapter>>;

export const BOOKING_ADAPTERS: BookingAdapters = { manual: manualAdapter, link: linkAdapter, cal_com: calComAdapter };

/** The built-ins with a brand's own over them, by provider. */
export function bookingAdapters(over: BookingAdapters = {}): BookingAdapters {
  return { ...BOOKING_ADAPTERS, ...over };
}
