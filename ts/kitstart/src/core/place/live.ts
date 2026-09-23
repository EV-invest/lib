import type { DayOfWeek, Geo, OpeningHours, Place, PostalAddress, Rating, ServiceArea } from "./types";

/**
 * The live half of a place, as `GET <source>/locations/<slug>` answers it.
 * Every field is optional: whatever the source leaves out, the baked config
 * supplies. Validated here rather than cast — a response is a promise from
 * another service, not a type. The wire shape is the source's own:
 * `serviceArea` is a list of commune names.
 */
export interface PlaceLive<L extends string> {
  phone?: string;
  whatsapp?: string;
  address?: Omit<PostalAddress, "region" | "country">;
  geo?: Geo;
  storefrontPhoto?: string;
  landmark?: Readonly<Record<L, string>>;
  serviceArea?: readonly ServiceArea[];
  hours?: readonly OpeningHours[];
  rating?: Rating;
}

const DAYS: readonly DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const isDay = (d: unknown): d is DayOfWeek => DAYS.some(day => day === d);

function hours(v: unknown): OpeningHours[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: OpeningHours[] = [];
  for (const row of v) {
    if (!isObject(row) || !Array.isArray(row.days)) return undefined;
    const days = row.days.filter(isDay);
    const opens = str(row.opens);
    const closes = str(row.closes);
    if (days.length !== row.days.length || !opens || !closes || !TIME.test(opens) || !TIME.test(closes)) {
      return undefined;
    }
    out.push({ days, opens, closes });
  }
  return out;
}

function rating(v: unknown): Rating | undefined {
  if (!isObject(v)) return undefined;
  const value = num(v.value);
  const count = num(v.count);
  const fetchedAt = str(v.fetchedAt);
  if (value === undefined || count === undefined || !fetchedAt || Number.isNaN(Date.parse(fetchedAt))) return undefined;
  if (value < 1 || value > 5 || count < 0) return undefined;
  return { value, count, fetchedAt };
}

function httpsUrl(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  try {
    return new URL(s).protocol === "https:" ? s : undefined;
  } catch {
    return undefined;
  }
}

function landmark<L extends string>(v: unknown, locales: readonly L[]): Record<L, string> | undefined {
  if (!isObject(v)) return undefined;
  const out: Partial<Record<L, string>> = {};
  for (const locale of locales) {
    const text = str(v[locale]);
    if (!text) return undefined;
    out[locale] = text;
  }
  return isComplete(out, locales) ? out : undefined;
}

function isComplete<L extends string>(record: Partial<Record<L, string>>, locales: readonly L[]): record is Record<L, string> {
  return locales.every(locale => typeof record[locale] === "string");
}

/**
 * Drops what does not validate instead of failing the page on one bad field.
 * A landmark counts only when it is given in every one of `locales`.
 */
export function parsePlaceLive<L extends string>(body: unknown, locales: readonly L[]): PlaceLive<L> {
  if (!isObject(body)) throw new Error("live location: body is not an object");
  const live: PlaceLive<L> = {};
  const phone = str(body.phone);
  if (phone?.startsWith("+")) live.phone = phone;
  const whatsapp = str(body.whatsapp);
  if (whatsapp?.startsWith("+")) live.whatsapp = whatsapp;
  if (isObject(body.address)) {
    const street = str(body.address.street);
    const postalCode = str(body.address.postalCode);
    const locality = str(body.address.locality);
    if (street && postalCode && /^\d{5}$/.test(postalCode) && locality) live.address = { street, postalCode, locality };
  }
  if (isObject(body.geo)) {
    const lat = num(body.geo.lat);
    const lng = num(body.geo.lng);
    if (lat !== undefined && lng !== undefined) live.geo = { lat, lng };
  }
  const h = hours(body.hours);
  if (h && h.length > 0) live.hours = h;
  const photo = httpsUrl(body.storefrontPhoto);
  if (photo) live.storefrontPhoto = photo;
  const mark = landmark(body.landmark, locales);
  if (mark) live.landmark = mark;
  if (Array.isArray(body.serviceArea)) {
    const names = body.serviceArea.map(str).filter((a): a is string => a !== undefined);
    if (names.length > 0) live.serviceArea = [{ kind: "localities", names }];
  }
  const r = rating(body.rating);
  if (r) live.rating = r;
  return live;
}

/**
 * The live fields over the baked ones. A service-area place takes none of the
 * storefront's: an address, a pin or a photo from the source would give it a
 * front it does not have.
 */
export function mergeLive<L extends string>(baked: Place<L>, live: PlaceLive<L>): Place<L> {
  const front = baked.presence;
  return {
    ...baked,
    presence:
      front.kind === "storefront"
        ? {
            ...front,
            address: live.address ? { ...front.address, ...live.address } : front.address,
            geo: live.geo ?? front.geo,
            storefrontPhoto: live.storefrontPhoto ?? front.storefrontPhoto,
            landmark: live.landmark ?? front.landmark,
          }
        : front,
    channels: { phone: live.phone ?? baked.channels.phone, whatsapp: live.whatsapp ?? baked.channels.whatsapp },
    serviceArea: live.serviceArea ?? baked.serviceArea,
    hours: live.hours ?? baked.hours,
    rating: live.rating ?? baked.rating,
  };
}
