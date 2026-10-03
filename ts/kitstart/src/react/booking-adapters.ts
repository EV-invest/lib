import { isPageProvider, type BookingChoice, type OpenBookingConfig } from "../core/booking/model";
import { bookingHref } from "../core/booking/url";

/** What a provider may say about the slot it booked; all optional, never shown as is. */
export interface BookedSlot {
  startAt?: string;
  endAt?: string;
}

/** What the page hands an adapter when the visitor asks for a slot. */
export interface BookingContext {
  /** The booking the card offers (`bookingOf(place, variant)`). */
  config: OpenBookingConfig;
  /** The lead's public reference — the panel's lead id, and the join key a provider carries back. */
  leadRef: string;
  name?: string | null | undefined;
  phone?: string | null | undefined;
  locale: string;
  /** Called when the provider says on the page that the slot is booked. */
  onBooked?: (slot?: BookedSlot) => void;
}

/**
 * How a provider opens its booking — one adapter per provider, picked by the
 * config's `provider`; a brand registers its own (`bookingAdapters`) and
 * `LeadCapture` is not touched. `href` renders a plain link — opened by the
 * browser in a new tab, so no popup blocker and nothing fetched before the
 * click; `open` runs on the click instead (an embed that loads its script
 * then). Neither may touch the network before the click. `prefillsPhone`:
 * the provider's form gets the visitor's number, so the card need not ask
 * them to type it again.
 */
export interface BookingAdapter<P extends string = string> {
  provider: P;
  href?: (ctx: BookingContext) => string | null;
  open?: (ctx: BookingContext) => void | Promise<void>;
  prefillsPhone?: (ctx: BookingContext) => boolean;
}

/** The built-in choice a context carries, or `null` when it is not one. */
function choiceOf(config: OpenBookingConfig): BookingChoice | null {
  if (config.provider === "manual") return { provider: "manual" };
  return isPageProvider(config.provider) && config.url ? { provider: config.provider, url: config.url } : null;
}

const hrefOf = (ctx: BookingContext): string | null => {
  const choice = choiceOf(ctx.config);
  return choice && bookingHref(choice, { leadRef: ctx.leadRef, name: ctx.name, phone: ctx.phone });
};

/** `manual`: no page to open — the card promises the call and offers a preference. */
export const manualAdapter: BookingAdapter<"manual"> = { provider: "manual" };

/** `link`: the page with `ref=<leadRef>`. */
export const linkAdapter: BookingAdapter<"link"> = { provider: "link", href: hrefOf };

/** `google_calendar`: the schedule as is — it takes no parameter, so the visitor types the same number there. */
export const googleCalendarAdapter: BookingAdapter<"google_calendar"> = { provider: "google_calendar", href: hrefOf };

/** `cal_com`: the event with the name, the phone and `metadata[ref]`. */
export const calComAdapter: BookingAdapter<"cal_com"> = { provider: "cal_com", href: hrefOf, prefillsPhone: () => true };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function addScript(src: string): void {
  const el = document.createElement("script");
  el.src = src;
  el.async = true;
  document.head.appendChild(el);
}

type CalApi = ((...args: unknown[]) => void) & { q?: unknown[][]; loaded?: boolean; ns?: Record<string, unknown> };
type EmbedWindow = Window & { Cal?: CalApi };

/** Cal.com's own queue stub, as its embed snippet installs it; the script is added on the first call. */
function calQueue(w: EmbedWindow, script: string): CalApi {
  if (w.Cal) return w.Cal;
  const cal: CalApi = (...args: unknown[]) => {
    if (!cal.loaded) {
      cal.ns = {};
      addScript(script);
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
 * `cal_com` as Cal.com's modal on the page: its script loads only on the
 * click, and its `bookingSuccessful` is `onBooked`. Opt-in (`bookingEmbed`),
 * and only once the visitor accepted the provider's cookies.
 */
/** What the page's one set of Cal.com listeners reports to: the lead last opened, and the leads already booked. */
interface CalPage {
  current: BookingContext | null;
  booked: Set<string>;
}

/** Per `Cal` instance — one per page — so the listeners are registered once however often the modal opens. */
const calPages = new WeakMap<CalApi, CalPage>();

function calPage(cal: CalApi, origin: string): CalPage {
  const known = calPages.get(cal);
  if (known) return known;
  const page: CalPage = { current: null, booked: new Set() };
  calPages.set(cal, page);
  const booked = (e: unknown) => {
    const ctx = page.current;
    // Cal.com may fire both versions of the event for one booking.
    if (!ctx || page.booked.has(ctx.leadRef)) return;
    page.booked.add(ctx.leadRef);
    const detail = isObject(e) ? e.detail : undefined;
    const data = isObject(detail) && isObject(detail.data) ? detail.data : undefined;
    const startAt = data?.startTime ?? data?.date;
    const endAt = data?.endTime;
    ctx.onBooked?.({ ...(typeof startAt === "string" ? { startAt } : {}), ...(typeof endAt === "string" ? { endAt } : {}) });
  };
  cal("init", { origin });
  cal("on", { action: "bookingSuccessful", callback: booked });
  cal("on", { action: "bookingSuccessfulV2", callback: booked });
  return page;
}

/**
 * `cal_com` as Cal.com's modal on the page: its script loads only on the
 * click, and its `bookingSuccessful` is `onBooked` — once per lead, however
 * often the modal is opened and closed. Opt-in (`bookingEmbed`), and only
 * once the visitor accepted the provider's cookies.
 */
export const calComEmbedAdapter: BookingAdapter<"cal_com"> = {
  provider: "cal_com",
  prefillsPhone: () => true,
  open: ctx => {
    const href = hrefOf(ctx);
    if (href === null) return;
    const u = new URL(href);
    const origin = calComEmbedOrigin(href);
    const cal = calQueue(window, `${origin}/embed/embed.js`);
    calPage(cal, origin).current = ctx;
    cal("modal", { calLink: u.pathname.slice(1), config: Object.fromEntries(u.searchParams) });
  },
};

/** Adapters by provider: the built-ins, and whatever a brand registers. */
export type BookingAdapters = Readonly<Record<string, BookingAdapter>>;

export const BOOKING_ADAPTERS: BookingAdapters = {
  manual: manualAdapter,
  link: linkAdapter,
  google_calendar: googleCalendarAdapter,
  cal_com: calComAdapter,
};

/** The embeds `bookingEmbed` turns on. */
export const BOOKING_EMBEDS: BookingAdapters = { cal_com: calComEmbedAdapter };

/** The built-ins with a brand's own over them, by provider. */
export function bookingAdapters(over: BookingAdapters = {}): BookingAdapters {
  return { ...BOOKING_ADAPTERS, ...over };
}
