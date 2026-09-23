import type { Lead } from "../core/lead";
import type { Place } from "../core/place/types";

/** One string in every locale. */
function sameIn<L extends string>(locales: readonly L[], text: string): Record<L, string> {
  const out: Partial<Record<L, string>> = {};
  for (const l of locales) out[l] = text;
  if (!complete(out, locales)) throw new Error("sameIn: a locale was skipped");
  return out;
}

function complete<L extends string>(record: Partial<Record<L, string>>, locales: readonly L[]): record is Record<L, string> {
  return locales.every(l => typeof record[l] === "string");
}

/**
 * Places and leads for a brand's tests, in the two shapes the model has. Each
 * takes overrides, so a test names only what it is about.
 */
export function storefrontPlace<L extends string>(
  locales: readonly L[],
  over: Partial<Place<L>> & { slug?: string } = {},
): Place<L> {
  const name = sameIn(locales, "Royat");
  return {
    slug: "royat",
    gbpName: "Test Storefront — Royat",
    name,
    presence: {
      kind: "storefront",
      address: { street: "2 Av. Abbé Védrine", postalCode: "63130", locality: "Royat", region: "Auvergne-Rhône-Alpes", country: "FR" },
      geo: null,
      storefrontPhoto: null,
      landmark: null,
    },
    serviceArea: null,
    channels: { phone: null, whatsapp: null },
    hours: null,
    rating: null,
    ...over,
  };
}

export function serviceAreaPlace<L extends string>(locales: readonly L[], over: Partial<Place<L>> = {}): Place<L> {
  const name = sameIn(locales, "Paris");
  return {
    slug: "paris",
    gbpName: "Test Service — Paris",
    name,
    presence: { kind: "service-area" },
    serviceArea: [{ kind: "localities", names: ["Paris", "Boulogne-Billancourt"] }],
    channels: { phone: null, whatsapp: null },
    hours: [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "19:00" }],
    rating: null,
    ...over,
  };
}

export function testLead(over: Partial<Lead> = {}): Lead {
  return { subject: "other", locality: "63130", mobile: "06 12 34 56 78", extras: {}, placeSlug: null, spamVerdict: null, ...over };
}
