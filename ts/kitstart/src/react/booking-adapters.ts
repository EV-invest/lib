import { bookingHref } from "../core/booking/url";
import type { BookingConfig, BookingProvider } from "../core/booking/model";

/** What a provider may say about the slot it booked; all optional, never shown as is. */
export interface BookedSlot {
  startAt?: string;
  endAt?: string;
}

/** What the page hands an adapter when the visitor asks for a slot. */
export interface BookingContext {
  config: BookingConfig;
  /** The lead's public reference — the panel's lead id, and the join key every provider carries back. */
  leadRef: string;
  name?: string | null | undefined;
  phone?: string | null | undefined;
  locale: string;
  /** Called when the provider says on the page that the slot is booked. */
  onBooked?: (slot?: BookedSlot) => void;
}

/**
 * How a provider opens its booking — one adapter per provider; a new one
 * (`calendly`) is one more entry here. `href` renders a plain link — opened
 * by the browser, so no popup blocker and nothing fetched before the click;
 * `open` runs on the click instead (an embed that loads its script then).
 * Neither may touch the network before the click.
 */
export interface BookingAdapter<P extends BookingProvider = BookingProvider> {
  provider: P;
  href?: (ctx: BookingContext) => string | null;
  open?: (ctx: BookingContext) => void | Promise<void>;
}

/** `manual`: no page to open — the card promises the call and offers a preference. */
export const manualAdapter: BookingAdapter<"manual"> = { provider: "manual" };

/** `link`: the page with `ref=<leadRef>`, in a new tab. */
export const linkAdapter: BookingAdapter<"link"> = {
  provider: "link",
  href: ctx => bookingHref(ctx.config, { leadRef: ctx.leadRef }),
};

/** `cal_com`: the event page with the name, phone and `metadata[ref]` prefilled, in a new tab. */
export const calComAdapter: BookingAdapter<"cal_com"> = {
  provider: "cal_com",
  href: ctx => bookingHref(ctx.config, { leadRef: ctx.leadRef, name: ctx.name, phone: ctx.phone }),
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
 * slot was taken. A brand that wants it registers it:
 * `bookingAdapters={{ cal_com: calComEmbedAdapter }}`.
 */
export const calComEmbedAdapter: BookingAdapter<"cal_com"> = {
  provider: "cal_com",
  open: ctx => {
    if (ctx.config.provider !== "cal_com") return;
    const origin = calComEmbedOrigin(ctx.config.url);
    const cal = calQueue(window, `${origin}/embed/embed.js`);
    const href = bookingHref(ctx.config, { leadRef: ctx.leadRef, name: ctx.name, phone: ctx.phone });
    if (href === null) return;
    const u = new URL(href);
    const config = Object.fromEntries(u.searchParams);
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
    cal("modal", { calLink: u.pathname.slice(1), config });
  },
};

export type BookingAdapters = { readonly [P in BookingProvider]: BookingAdapter<P> };

export const BOOKING_ADAPTERS: BookingAdapters = { manual: manualAdapter, link: linkAdapter, cal_com: calComAdapter };

/** The built-ins with a brand's own over them, by provider. */
export function bookingAdapters(over: Partial<BookingAdapters> = {}): BookingAdapters {
  return { ...BOOKING_ADAPTERS, ...over };
}
