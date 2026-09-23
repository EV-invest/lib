import type { Place } from "./types";

/**
 * The fields that make a place's page about *that* place. Google's spam policy
 * names "many similar pages that funnel to one business" as doorway pages, and
 * a network of pages that differ only by address is exactly that. So a place
 * is indexable only once it says something its neighbours cannot.
 */
export type PublicationField = "storefrontPhoto" | "landmark" | "serviceArea" | "hours";

/** Which fields a place must fill before it may be indexed. */
export interface PublicationPolicy {
  required(place: Place<string>): readonly PublicationField[];
}

/**
 * A storefront network: what the place looks like, how to find it, where its
 * van goes, and when it opens.
 */
export const STOREFRONT_GATE: PublicationPolicy = {
  required: () => ["storefrontPhoto", "landmark", "serviceArea", "hours"],
};

/** A service-area business has no front to photograph: its zone and its hours. */
export const SERVICE_AREA_GATE: PublicationPolicy = {
  required: () => ["serviceArea", "hours"],
};

function filled(place: Place<string>, field: PublicationField): boolean {
  const front = place.presence.kind === "storefront" ? place.presence : null;
  switch (field) {
    case "storefrontPhoto":
      return Boolean(front?.storefrontPhoto);
    case "landmark":
      return Boolean(front?.landmark) && Object.values(front?.landmark ?? {}).every(v => v.trim() !== "");
    case "serviceArea":
      return place.serviceArea !== null && place.serviceArea.length > 0;
    case "hours":
      return place.hours !== null && place.hours.length > 0;
  }
}

/** What is still missing, in the policy's order; empty means the place may be indexed. */
export function publicationGaps(place: Place<string>, policy: PublicationPolicy): PublicationField[] {
  return policy.required(place).filter(field => !filled(place, field));
}

/**
 * An unpublished place still answers — its phone is real and someone may have
 * been given the link — but it carries `noindex` and stays out of the sitemap.
 * A site with no domain yet publishes nothing.
 */
export function isPublished(place: Place<string>, policy: PublicationPolicy, site: { domain: string | null }): boolean {
  return site.domain !== null && publicationGaps(place, policy).length === 0;
}
